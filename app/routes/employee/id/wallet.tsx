import { invariantResponse } from '@epic-web/invariant'
import { type Route } from './+types/wallet.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	getDefaultExpirationDate,
	fetchAndCacheFactsProfilePicture,
} from '#app/utils/employee.server.ts'
import {
	generateAppleWalletPass,
	generateGooglePayPass,
} from '#app/utils/wallet-pass.server.ts'
import { getDeviceTypeFromRequest } from '#app/utils/device-detection.server.ts'
import { type EmployeePDFData } from '#app/components/employee-id-card.tsx'

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)

	// Get the authenticated user's email
	const user = await prisma.user.findUnique({
		select: { email: true },
		where: { id: userId },
	})

	if (!user) {
		throw new Response('User not found', { status: 404 })
	}

	// Find employee by matching email
	const employee = await prisma.employee.findUnique({
		where: { email: user.email },
		select: {
			id: true,
			sisEmployeeId: true,
			fullName: true,
			jobTitle: true,
			email: true,
			status: true,
			employeeId: {
				select: {
					photoUrl: true,
					expirationDate: true,
				},
			},
		},
	})

	invariantResponse(employee, 'Employee record not found', { status: 404 })

	// Ensure EmployeeID record exists (create if missing)
	let employeeId = employee.employeeId
	if (!employeeId) {
		employeeId = await prisma.employeeID.create({
			data: {
				employeeId: employee.id,
				expirationDate: getDefaultExpirationDate(),
			},
			select: {
				photoUrl: true,
				expirationDate: true,
			},
		})
	}

	// If no uploaded photo exists, try to fetch and cache from FACTS
	if (!employeeId.photoUrl && employee.sisEmployeeId) {
		fetchAndCacheFactsProfilePicture(employee.id, employee.sisEmployeeId).catch(
			(error) => {
				console.warn(
					`Background FACTS photo fetch failed for employee ${employee.id}:`,
					error,
				)
			},
		)
	}

	// Prepare employee data for wallet pass generation
	const employeeData: EmployeePDFData = {
		id: employee.id,
		fullName: employee.fullName,
		jobTitle: employee.jobTitle,
		email: employee.email,
		status: employee.status,
		sisEmployeeId: employee.sisEmployeeId,
		photoUrl: employeeId.photoUrl || null,
		expirationDate: employeeId.expirationDate
			? new Date(employeeId.expirationDate)
			: getDefaultExpirationDate(),
	}

	// Detect device type
	const deviceType = getDeviceTypeFromRequest(request)

	// Generate appropriate wallet pass based on device
	let passBuffer: Buffer
	let contentType: string
	let filename: string

	try {
		if (deviceType === 'ios') {
			// Generate Apple Wallet pass
			passBuffer = await generateAppleWalletPass(employeeData, request)
			contentType = 'application/vnd.apple.pkpass'
			filename = `employee-id-${employee.sisEmployeeId || employee.id}.pkpass`
		} else if (deviceType === 'android') {
			// Generate Google Pay pass (JSON format)
			const passJson = await generateGooglePayPass(employeeData, request)
			passBuffer = Buffer.from(passJson, 'utf-8')
			contentType = 'application/json'
			filename = `employee-id-${employee.sisEmployeeId || employee.id}.json`
		} else {
			// Unknown device - default to Apple Wallet
			passBuffer = await generateAppleWalletPass(employeeData, request)
			contentType = 'application/vnd.apple.pkpass'
			filename = `employee-id-${employee.sisEmployeeId || employee.id}.pkpass`
		}
	} catch (error) {
		// If wallet pass generation fails, return error response
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'
		throw new Response(`Failed to generate wallet pass: ${errorMessage}`, {
			status: 500,
		})
	}

	// Return wallet pass file
	return new Response(passBuffer, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': passBuffer.length.toString(),
		},
	})
}
