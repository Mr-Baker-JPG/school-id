import { OpenImgContextProvider } from 'openimg/react'
import {
	data,
	Link,
	Links,
	Meta,
	Outlet,
	redirect,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from 'react-router'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import { type Route } from './+types/root.ts'
import appleTouchIconAssetUrl from './assets/favicons/apple-touch-icon.png'
import faviconAssetUrl from './assets/favicons/favicon.svg'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { EpicProgress } from './components/progress-bar.tsx'
import { useToast } from './components/toaster.tsx'
import { Button } from './components/ui/button.tsx'
import { href as iconsHref } from './components/ui/icon.tsx'
import { EpicToaster } from './components/ui/sonner.tsx'
import { UserDropdown } from './components/user-dropdown.tsx'
import { useOptionalTheme, useTheme } from './routes/resources/theme-switch.tsx'
import { getSchoolConfig, isSetupComplete } from './utils/school-config.server.ts'
import tailwindStyleSheetUrl from './styles/tailwind.css?url'
import { getUserId, logout } from './utils/auth.server.ts'
import { ClientHintCheck, getHints } from './utils/client-hints.tsx'
import { prisma } from './utils/db.server.ts'
import { getEnv } from './utils/env.server.ts'
import { pipeHeaders } from './utils/headers.server.ts'
import { honeypot } from './utils/honeypot.server.ts'
import { combineHeaders, getDomainUrl, getImgSrc } from './utils/misc.tsx'
import { useNonce } from './utils/nonce-provider.ts'
import { type Theme, getTheme } from './utils/theme.server.ts'
import { makeTimings, time } from './utils/timing.server.ts'
import { getToast } from './utils/toast.server.ts'
import { useOptionalUser } from './utils/user.ts'
import { userHasRole } from './utils/user.ts'

export const links: Route.LinksFunction = () => {
	return [
		// Preload svg sprite as a resource to avoid render blocking
		{ rel: 'preload', href: iconsHref, as: 'image' },
		{
			rel: 'icon',
			href: '/favicon.ico',
			sizes: '48x48',
		},
		{ rel: 'icon', type: 'image/svg+xml', href: faviconAssetUrl },
		{ rel: 'apple-touch-icon', href: appleTouchIconAssetUrl },
		{
			rel: 'manifest',
			href: '/site.webmanifest',
			crossOrigin: 'use-credentials',
		} as const, // necessary to make typescript happy
		{ rel: 'stylesheet', href: tailwindStyleSheetUrl },
		// Brand body font: EB Garamond (display font TrajanPro loaded via @font-face)
		{
			rel: 'stylesheet',
			href: 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap',
		},
	].filter(Boolean)
}

export const meta: Route.MetaFunction = ({ data }) => {
	const appName = data?.schoolConfig?.schoolShortName
		? `${data.schoolConfig.schoolShortName} ID System`
		: 'School ID System'
	return [
		{ title: data ? appName : `Error | ${appName}` },
		{
			name: 'description',
			content: 'View and download your official ID card',
		},
	]
}

export async function loader({ request }: Route.LoaderArgs) {
	const timings = makeTimings('root loader')

	// Redirect to setup wizard if initial setup hasn't been completed
	const url = new URL(request.url)
	if (!url.pathname.startsWith('/install') && !url.pathname.startsWith('/resources')) {
		const setupDone = await isSetupComplete()
		if (!setupDone) {
			throw redirect('/install')
		}
	}

	const userId = await time(() => getUserId(request), {
		timings,
		type: 'getUserId',
		desc: 'getUserId in root',
	})

	const user = userId
		? await time(
				() =>
					prisma.user.findUnique({
						select: {
							id: true,
							name: true,
							username: true,
							email: true,
							image: { select: { objectKey: true } },
							roles: {
								select: {
									name: true,
									permissions: {
										select: { entity: true, action: true, access: true },
									},
								},
							},
						},
						where: { id: userId },
					}),
				{ timings, type: 'find user', desc: 'find user in root' },
			)
		: null

	// Determine person type for navigation
	let personType: 'admin' | 'employee' | 'student' | null = null
	if (user) {
		const isAdmin = user.roles.some((role) => role.name === 'admin')
		if (isAdmin) {
			personType = 'admin'
		} else {
			const employee = await prisma.employee.findUnique({
				where: { email: user.email },
				select: { id: true },
			})
			if (employee) {
				personType = 'employee'
			} else {
				const student = await prisma.student.findUnique({
					where: { email: user.email },
					select: { id: true },
				})
				if (student) {
					personType = 'student'
				}
			}
		}
	}

	if (userId && !user) {
		console.info('something weird happened')
		// something weird happened... The user is authenticated but we can't find
		// them in the database. Maybe they were deleted? Let's log them out.
		await logout({ request, redirectTo: '/' })
	}
	const { toast, headers: toastHeaders } = await getToast(request)
	const honeyProps = await honeypot.getInputProps()
	const schoolConfig = await getSchoolConfig()

	return data(
		{
			user,
			personType,
			requestInfo: {
				hints: getHints(request),
				origin: getDomainUrl(request),
				path: new URL(request.url).pathname,
				userPrefs: {
					theme: getTheme(request),
				},
			},
			ENV: getEnv(),
			toast,
			honeyProps,
			schoolConfig: {
				schoolName: schoolConfig.schoolName,
				schoolShortName: schoolConfig.schoolShortName,
				logoUrl: schoolConfig.logoUrl,
				crestUrl: schoolConfig.crestUrl,
				primaryColor: schoolConfig.primaryColor,
				googleEnabled: schoolConfig.googleEnabled,
			},
		},
		{
			headers: combineHeaders(
				{ 'Server-Timing': timings.toString() },
				toastHeaders,
			),
		},
	)
}

export const headers: Route.HeadersFunction = pipeHeaders

function Document({
	children,
	nonce,
	theme = 'light',
	env = {},
	appShortName = 'School ID',
}: {
	children: React.ReactNode
	nonce: string
	theme?: Theme
	env?: Record<string, string | undefined>
	appShortName?: string
}) {
	const allowIndexing = ENV.ALLOW_INDEXING !== 'false'
	return (
		<html lang="en" className={`${theme} h-full overflow-x-hidden`}>
			<head>
				<ClientHintCheck nonce={nonce} />
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				{allowIndexing ? null : (
					<meta name="robots" content="noindex, nofollow" />
				)}
				{/* iOS PWA meta tags */}
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-status-bar-style" content="default" />
				<meta name="apple-mobile-web-app-title" content={appShortName} />
				<Links />
			</head>
			<body className="bg-background text-foreground">
				{children}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				<ScrollRestoration nonce={nonce} />
				<Scripts nonce={nonce} />
			</body>
		</html>
	)
}

export function Layout({ children }: { children: React.ReactNode }) {
	// if there was an error running the loader, data could be missing
	const data = useLoaderData<typeof loader | null>()
	const nonce = useNonce()
	const theme = useOptionalTheme() ?? 'light'
	const appShortName = data?.schoolConfig?.schoolShortName
		? `${data.schoolConfig.schoolShortName} ID`
		: 'School ID'
	return (
		<Document nonce={nonce} theme={theme} env={data?.ENV} appShortName={appShortName}>
			{children}
		</Document>
	)
}

function App() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const theme = useTheme()
	const isAdmin = user ? userHasRole(user, 'admin') : false
	useToast(data.toast)

	return (
		<OpenImgContextProvider
			optimizerEndpoint="/resources/images"
			getSrc={getImgSrc}
		>
			<div className="flex min-h-screen flex-col justify-between">
				{/* <header className="container py-6">
					<nav className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap md:gap-8">
						<Logo />
						<div className="ml-auto flex items-center gap-6">
							{user ? (
								<>
									<Button asChild variant="ghost">
										<Link to="/employee/id">My ID</Link>
									</Button>
									{isAdmin && (
										<Button asChild variant="ghost">
											<Link to="/admin/employees">Admin Dashboard</Link>
										</Button>
									)}
									<UserDropdown />
								</>
							) : null
							// <Button asChild variant="default" size="lg">
							// 	<Link to="/login">Log In</Link>
							// </Button>
							}
						</div>
					</nav>
				</header> */}

				<div className="flex flex-1 flex-col">
					<Outlet />
				</div>
			</div>
			<EpicToaster closeButton position="top-center" theme={theme} />
			<EpicProgress />
		</OpenImgContextProvider>
	)
}

function Logo() {
	const data = useLoaderData<typeof loader | null>()
	const shortName = data?.schoolConfig?.schoolShortName || 'School'
	return (
		<Link to="/" className="group grid leading-snug">
			<span className="font-light transition group-hover:-translate-x-1">
				{shortName}
			</span>
			<span className="font-bold transition group-hover:translate-x-1">
				ID System
			</span>
		</Link>
	)
}

function AppWithProviders() {
	const data = useLoaderData<typeof loader>()
	return (
		<HoneypotProvider {...data.honeyProps}>
			<App />
		</HoneypotProvider>
	)
}

export default AppWithProviders

// this is a last resort error boundary. There's not much useful information we
// can offer at this level.
export const ErrorBoundary = GeneralErrorBoundary
