import { Img } from 'openimg/react'
import { Link } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from '#app/components/ui/sheet.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { type ExpirationStatus } from '#app/utils/employee.server.ts'
import { getEmployeePhotoSrc } from '#app/utils/misc.tsx'

interface EmployeeQuickViewDrawerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	employee: {
		id: string
		fullName: string
		jobTitle: string
		email: string
		status: string
		employeeId?: {
			photoUrl: string | null
			expirationDate: Date | null
		} | null
		expirationStatus?: ExpirationStatus | null
	}
}

export function EmployeeQuickViewDrawer({
	open,
	onOpenChange,
	employee,
}: EmployeeQuickViewDrawerProps) {
	const photoUrl = employee.employeeId?.photoUrl
	const expirationDate = employee.employeeId?.expirationDate
		? new Date(employee.employeeId.expirationDate).toLocaleDateString()
		: 'Not set'

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>Employee Quick View</SheetTitle>
				</SheetHeader>

				<div className="mt-6 space-y-6">
					{/* Photo */}
					<div className="flex justify-center">
						{photoUrl ? (
							<Img
								src={getEmployeePhotoSrc(photoUrl)}
								alt={employee.fullName}
								className="size-32 rounded-lg object-cover"
								width={128}
								height={128}
							/>
						) : (
							<div className="bg-muted-foreground/20 flex size-32 items-center justify-center rounded-lg">
								<Icon name="avatar" className="text-muted-foreground size-16" />
							</div>
						)}
					</div>

					{/* Status */}
					<div>
						<h3 className="text-foreground mb-2 text-sm font-semibold">
							Status
						</h3>
						<StatusBadge
							variant={employee.status === 'active' ? 'active' : 'inactive'}
						>
							{employee.status}
						</StatusBadge>
					</div>

					{/* Expiration */}
					<div>
						<h3 className="text-foreground mb-2 text-sm font-semibold">
							Expiration Date
						</h3>
						<div className="flex flex-col gap-2">
							<p className="text-foreground">{expirationDate}</p>
							{employee.expirationStatus &&
								employee.expirationStatus.type !== 'valid' && (
									<StatusBadge
										variant={
											employee.expirationStatus.type === 'expiring'
												? 'expiring'
												: 'expired'
										}
									>
										{employee.expirationStatus.type === 'expiring'
											? `Expires in ${employee.expirationStatus.daysUntilExpiration} day${employee.expirationStatus.daysUntilExpiration !== 1 ? 's' : ''}`
											: `Expired ${employee.expirationStatus.daysSinceExpiration} day${employee.expirationStatus.daysSinceExpiration !== 1 ? 's' : ''} ago`}
									</StatusBadge>
								)}
						</div>
					</div>

					{/* Employee Info */}
					<div>
						<h3 className="text-foreground mb-2 text-sm font-semibold">
							Employee Information
						</h3>
						<KeyValueList
							items={[
								{ key: 'Name', value: employee.fullName },
								{ key: 'Job Title', value: employee.jobTitle },
								{ key: 'Email', value: employee.email },
							]}
						/>
					</div>

					{/* Actions */}
					<div className="flex flex-col gap-2 pt-4">
						<Button asChild>
							<Link to={`/admin/employees/${employee.id}`}>
								<Icon name="pencil-1" />
								Open Full Details
							</Link>
						</Button>
						<Button asChild variant="outline">
							<Link to={`/admin/employees/${employee.id}/photo`}>
								<Icon name="camera" />
								Manage Photo
							</Link>
						</Button>
						<Button asChild variant="outline">
							<Link to={`/admin/employees/${employee.id}/expiration`}>
								<Icon name="calendar" />
								Update Expiration
							</Link>
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
