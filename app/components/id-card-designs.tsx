/**
 * 12 ID Card Design Variants addressing the design critique
 *
 * Shared improvements:
 * - Strict 2-color palette: navy #1B2A4A + maroon #8B1A2B
 * - 2 typefaces: Georgia serif (display) + system sans-serif (data)
 * - Prominent crest, proper hierarchy
 * - Structured back with school info, motto, return notice
 * - Rounded corners, photo borders, watermark security element
 */

import { getFirstAndLastName } from '#app/utils/misc.tsx'
import { type PersonType } from './employee-id-card.tsx'

export interface CardDesignProps {
	fullName: string
	personType: PersonType
	sisId: string
	academicYear: string
	photoUrl: string | null
	logoUrl: string | null
	schoolName: string
	qrCodeDataURL?: string
	/** Primary brand color (defaults to navy #1B2A4A) */
	primaryColor?: string
	/** Secondary brand color (defaults to maroon #8B1A2B) */
	secondaryColor?: string
	/** Accent/background color (defaults to cream #F5F0E8) */
	accentColor?: string
	/** School address line 1 */
	addressLine1?: string
	/** School address line 2 */
	addressLine2?: string
	/** School phone */
	phone?: string
}

function getColors(props: CardDesignProps) {
	return {
		NAVY: props.primaryColor || '#1B2A4A',
		MAROON: props.secondaryColor || '#8B1A2B',
		CREAM: props.accentColor || '#F5F0E8',
	}
}

function getContactInfo(props: CardDesignProps) {
	return {
		SCHOOL_ADDRESS_LINE1: props.addressLine1 || '',
		SCHOOL_ADDRESS_LINE2: props.addressLine2 || '',
		SCHOOL_PHONE: props.phone || '',
	}
}
const CW = 324
const CH = 204

function Shell({ children, bg = '#FFFFFF' }: { children: React.ReactNode; bg?: string }) {
	return (
		<div className="relative overflow-hidden shadow-md" style={{ width: CW, height: CH, backgroundColor: bg, borderRadius: 10 }}>
			{children}
		</div>
	)
}

function WM({ logoUrl, opacity = 0.04 }: { logoUrl: string | null; opacity?: number }) {
	if (!logoUrl) return null
	return (
		<div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity }}>
			<img src={logoUrl} alt="" style={{ width: 180, height: 180, objectFit: 'contain' }} />
		</div>
	)
}

function Photo({ url, name, w = 72, h = 90, border = '#1B2A4A' }: { url: string | null; name: string; w?: number; h?: number; border?: string }) {
	return (
		<div style={{ width: w, height: h, border: `2px solid ${border}`, borderRadius: 4, overflow: 'hidden', flexShrink: 0, backgroundColor: '#e5e5e5' }}>
			{url ? (
				<img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
			) : (
				<div className="flex items-center justify-center" style={{ width: '100%', height: '100%', fontSize: 9, color: '#999', fontFamily: 'system-ui' }}>No Photo</div>
			)}
		</div>
	)
}


function BackLayout({ props, variant = 'default' }: { props: CardDesignProps; variant?: string }) {
	const { NAVY, MAROON, CREAM } = getColors(props)
	const { SCHOOL_ADDRESS_LINE1, SCHOOL_ADDRESS_LINE2, SCHOOL_PHONE } = getContactInfo(props)
	const bg = variant === 'cream' ? CREAM : variant === 'navy' ? NAVY : '#FFFFFF'
	const textColor = variant === 'navy' ? '#ccc' : '#555'
	const headColor = variant === 'navy' ? '#fff' : NAVY
	return (
		<Shell bg={bg}>
			<WM logoUrl={props.logoUrl} opacity={variant === 'navy' ? 0.06 : 0.03} />
			{variant !== 'navy' && <div style={{ height: 3, backgroundColor: MAROON }} />}
			<div style={{ display: 'flex', height: '100%', padding: '12px 20px', gap: 16, alignItems: 'center' }}>
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					{props.qrCodeDataURL ? (
						<img src={props.qrCodeDataURL} alt="QR" style={{ width: 85, height: 85 }} />
					) : (
						<div style={{ width: 85, height: 85, backgroundColor: variant === 'navy' ? '#ffffff22' : '#eee', borderRadius: 4 }} />
					)}
					<div style={{ fontSize: 7, color: headColor, fontFamily: 'system-ui', fontWeight: 600, marginTop: 3 }}>VERIFY ID</div>
				</div>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
					<div style={{ fontSize: 9, fontWeight: 700, color: headColor, fontFamily: '"Georgia", serif' }}>{props.schoolName}</div>
					<div style={{ fontSize: 7, color: textColor, fontFamily: 'system-ui', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
						{SCHOOL_ADDRESS_LINE1}{'\n'}{SCHOOL_ADDRESS_LINE2}{'\n'}{SCHOOL_PHONE}
					</div>
					<div style={{ fontSize: 7, color: variant === 'navy' ? '#ccc' : MAROON, fontFamily: '"Georgia", serif', fontStyle: 'italic', marginTop: 3 }}>
						Ad Majorem Dei Gloriam
					</div>
					<div style={{ fontSize: 6, color: variant === 'navy' ? '#888' : '#aaa', fontFamily: 'system-ui', marginTop: 2 }}>
						If found, please return to the school office.
					</div>
				</div>
			</div>
			{variant !== 'navy' && <div style={{ height: 3, backgroundColor: variant === 'cream' ? NAVY : MAROON }} />}
		</Shell>
	)
}

/* ================================================================
 * DESIGN 1: "Classic Band" — Navy top/bottom bands, cream body
 * ================================================================ */
export function Design1Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg={CREAM}>
			<WM logoUrl={p.logoUrl} />
			<div style={{ backgroundColor: NAVY, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 16px' }}>
				{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />}
				<div style={{ color: '#fff', fontSize: 10.5, fontFamily: '"Georgia", serif', letterSpacing: 2, textTransform: 'uppercase' }}>{p.schoolName}</div>
			</div>
			<div style={{ height: 3, backgroundColor: MAROON }} />
			<div style={{ display: 'flex', flex: 1, padding: '8px 16px 6px' }}>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
					<div style={{ fontSize: 15, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.2 }}>{name}</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
						<span style={{ fontSize: 8, color: MAROON, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1.5 }}>{p.personType}</span>
						<span style={{ fontSize: 8, color: '#888', fontFamily: 'system-ui' }}>{p.academicYear}</span>
					</div>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', marginLeft: 12 }}>
					<Photo url={p.photoUrl} name={p.fullName} />
				</div>
			</div>
			<div style={{ backgroundColor: NAVY, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
				<span style={{ fontSize: 8, color: '#ccc', fontFamily: 'system-ui' }}>ID: {p.sisId}</span>
				<span style={{ fontSize: 6.5, color: '#999', fontFamily: '"Georgia", serif', fontStyle: 'italic', letterSpacing: 0.5 }}>Ad Majorem Dei Gloriam</span>
			</div>
		</Shell>
	)
}
export function Design1Back(p: CardDesignProps) { return <BackLayout props={p} variant="cream" /> }

/* ================================================================
 * DESIGN 2: "Full-Height Photo" — Photo spans right edge
 * ================================================================ */
export function Design2Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg="#fff">
			<div style={{ display: 'flex', height: '100%' }}>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 14px 10px', background: `linear-gradient(150deg, ${CREAM} 0%, #fff 100%)` }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
						{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />}
						<div style={{ fontSize: 8.5, fontFamily: '"Georgia", serif', color: NAVY, letterSpacing: 1, lineHeight: 1.3 }}>{p.schoolName.toUpperCase()}</div>
					</div>
					<div style={{ marginTop: 'auto' }}>
						<div style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.2 }}>{name}</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
							<span style={{ fontSize: 7.5, color: '#fff', backgroundColor: MAROON, padding: '1px 6px', borderRadius: 2, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>{p.personType}</span>
							<span style={{ fontSize: 8, color: '#777', fontFamily: 'system-ui' }}>{p.academicYear}</span>
						</div>
					</div>
					<div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${NAVY}33` }}>
						<div style={{ fontSize: 7, color: '#888', fontFamily: 'system-ui' }}>ID NUMBER</div>
						<div style={{ fontSize: 11, fontWeight: 700, color: NAVY, fontFamily: 'system-ui', letterSpacing: 0.5 }}>{p.sisId}</div>
					</div>
				</div>
				<div style={{ width: 100, backgroundColor: '#e5e5e5', borderLeft: `3px solid ${MAROON}` }}>
					{p.photoUrl ? (
						<img src={p.photoUrl} alt={p.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
					) : (
						<div className="flex items-center justify-center" style={{ width: '100%', height: '100%', fontSize: 10, color: '#999' }}>No Photo</div>
					)}
				</div>
			</div>
		</Shell>
	)
}
export function Design2Back(p: CardDesignProps) { return <BackLayout props={p} /> }

/* ================================================================
 * DESIGN 3: "Light Executive" — Design 4 layout, Design 5 colors
 * ================================================================ */
export function Design3Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg="#FFFFFF">
			<WM logoUrl={p.logoUrl} opacity={0.025} />
			{/* Thin maroon top accent (from Design 5) */}
			<div style={{ height: 4, backgroundColor: MAROON }} />
			{/* Design 4 layout: photo-left, info-right */}
			<div style={{ display: 'flex', height: 'calc(100% - 4px)' }}>
				<div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 14px 14px' }}>
					<Photo url={p.photoUrl} name={p.fullName} w={72} h={90} border={NAVY} />
				</div>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 14px 10px 14px', justifyContent: 'space-between' }}>
					<div>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />}
							<div style={{ fontSize: 7.5, color: '#888', fontFamily: '"Georgia", serif', letterSpacing: 1.5 }}>{p.schoolName.toUpperCase()}</div>
						</div>
						<div style={{ height: 1, backgroundColor: MAROON, marginTop: 8, marginBottom: 8 }} />
						<div style={{ fontSize: 15, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.2 }}>{name}</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
							<span style={{ fontSize: 8, color: '#fff', backgroundColor: MAROON, padding: '1px 6px', borderRadius: 2, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>{p.personType}</span>
							<span style={{ fontSize: 8, color: '#888', fontFamily: 'system-ui' }}>{p.academicYear}</span>
						</div>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
						<div>
							<div style={{ fontSize: 6.5, color: '#aaa', fontFamily: 'system-ui' }}>ID NUMBER</div>
							<div style={{ fontSize: 11, fontWeight: 700, color: NAVY, fontFamily: 'system-ui', letterSpacing: 0.5 }}>{p.sisId}</div>
						</div>
						<div style={{ fontSize: 6, color: '#bbb', fontFamily: '"Georgia", serif', fontStyle: 'italic' }}>AMDG</div>
					</div>
				</div>
			</div>
		</Shell>
	)
}
export function Design3Back(p: CardDesignProps) { return <BackLayout props={p} /> }

/* ================================================================
 * DESIGN 4: "Dark Executive" — Navy card, white/gold text, premium
 * ================================================================ */
export function Design4Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg={NAVY}>
			<WM logoUrl={p.logoUrl} opacity={0.06} />
			<div style={{ display: 'flex', height: '100%' }}>
				{/* Left: photo */}
				<div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 14px 14px' }}>
					<Photo url={p.photoUrl} name={p.fullName} w={72} h={90} border="#ffffff44" />
				</div>
				{/* Right: info */}
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 14px 10px 14px', justifyContent: 'space-between' }}>
					<div>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />}
							<div style={{ fontSize: 7.5, color: '#ccc', fontFamily: '"Georgia", serif', letterSpacing: 1.5 }}>{p.schoolName.toUpperCase()}</div>
						</div>
						<div style={{ height: 1, backgroundColor: MAROON, marginTop: 8, marginBottom: 8 }} />
						<div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', fontFamily: '"Georgia", serif', lineHeight: 1.2 }}>{name}</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
							<span style={{ fontSize: 8, color: CREAM, backgroundColor: MAROON, padding: '1px 6px', borderRadius: 2, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>{p.personType}</span>
							<span style={{ fontSize: 8, color: '#999', fontFamily: 'system-ui' }}>{p.academicYear}</span>
						</div>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
						<div>
							<div style={{ fontSize: 6.5, color: '#888', fontFamily: 'system-ui' }}>ID NUMBER</div>
							<div style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'system-ui', letterSpacing: 0.5 }}>{p.sisId}</div>
						</div>
						<div style={{ fontSize: 6, color: '#666', fontFamily: '"Georgia", serif', fontStyle: 'italic' }}>AMDG</div>
					</div>
				</div>
			</div>
		</Shell>
	)
}
export function Design4Back(p: CardDesignProps) { return <BackLayout props={p} variant="navy" /> }

/* ================================================================
 * DESIGN 5: "Modern Minimal" — White card, thin accents, spacious
 * ================================================================ */
export function Design5Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg="#FFFFFF">
			<WM logoUrl={p.logoUrl} opacity={0.025} />
			{/* Thin top maroon line */}
			<div style={{ height: 4, backgroundColor: MAROON }} />
			<div style={{ display: 'flex', height: 'calc(100% - 4px)', padding: 14 }}>
				{/* Photo */}
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 14 }}>
					<Photo url={p.photoUrl} name={p.fullName} w={68} h={85} border={NAVY} />
					<div style={{ fontSize: 9, fontWeight: 700, color: NAVY, fontFamily: 'system-ui', marginTop: 6, letterSpacing: 0.5 }}>{p.sisId}</div>
				</div>
				{/* Info */}
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
						<div style={{ fontSize: 7, color: NAVY, fontFamily: '"Georgia", serif', letterSpacing: 1.5, lineHeight: 1.3 }}>{p.schoolName.toUpperCase()}</div>
					</div>
					<div style={{ width: 30, height: 2, backgroundColor: MAROON, marginTop: 6, marginBottom: 10 }} />
					<div style={{ fontSize: 16, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.15, marginTop: 'auto' }}>{name}</div>
					<div style={{ display: 'flex', gap: 10, marginTop: 6, marginBottom: 2 }}>
						<div>
							<div style={{ fontSize: 6, color: '#aaa', fontFamily: 'system-ui', letterSpacing: 1 }}>ROLE</div>
							<div style={{ fontSize: 9, color: NAVY, fontFamily: 'system-ui', fontWeight: 600 }}>{p.personType}</div>
						</div>
						<div>
							<div style={{ fontSize: 6, color: '#aaa', fontFamily: 'system-ui', letterSpacing: 1 }}>YEAR</div>
							<div style={{ fontSize: 9, color: NAVY, fontFamily: 'system-ui', fontWeight: 600 }}>{p.academicYear}</div>
						</div>
					</div>
				</div>
			</div>
		</Shell>
	)
}
export function Design5Back(p: CardDesignProps) { return <BackLayout props={p} /> }

/* ================================================================
 * DESIGN 6: "Ribbon Banner" — Maroon ribbon band across center
 * ================================================================ */
export function Design6Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg="#FFFFFF">
			<WM logoUrl={p.logoUrl} opacity={0.025} />
			{/* Top section: school identity + photo */}
			<div style={{ display: 'flex', padding: '10px 16px 0', alignItems: 'flex-start', gap: 12 }}>
				<Photo url={p.photoUrl} name={p.fullName} w={68} h={85} border={NAVY} />
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 2 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
						<div style={{ fontSize: 7, color: NAVY, fontFamily: '"Georgia", serif', letterSpacing: 1.5, lineHeight: 1.3 }}>{p.schoolName.toUpperCase()}</div>
					</div>
					<div style={{ width: 30, height: 1, backgroundColor: NAVY + '33', marginTop: 6, marginBottom: 6 }} />
					<div style={{ fontSize: 15, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.15 }}>{name}</div>
				</div>
			</div>
			{/* Maroon ribbon band */}
			<div style={{ backgroundColor: MAROON, margin: '8px 0 0', padding: '4px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
				<span style={{ fontSize: 8, color: '#fff', fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 2 }}>{p.personType}</span>
				<span style={{ fontSize: 7, color: '#ffffffaa', fontFamily: '"Georgia", serif', fontStyle: 'italic' }}>Ad Majorem Dei Gloriam</span>
			</div>
			{/* Bottom: ID + year */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px 8px' }}>
				<div>
					<div style={{ fontSize: 6, color: '#aaa', fontFamily: 'system-ui', letterSpacing: 1 }}>ID NUMBER</div>
					<div style={{ fontSize: 11, fontWeight: 700, color: NAVY, fontFamily: 'system-ui' }}>{p.sisId}</div>
				</div>
				<div style={{ fontSize: 8, color: '#999', fontFamily: 'system-ui' }}>{p.academicYear}</div>
			</div>
		</Shell>
	)
}
export function Design6Back(p: CardDesignProps) { return <BackLayout props={p} /> }

/* ================================================================
 * DESIGN 7: "Centered Portrait" — Photo centered top, symmetric
 * ================================================================ */
export function Design7Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg={CREAM}>
			<WM logoUrl={p.logoUrl} />
			{/* Navy header strip with logo */}
			<div style={{ backgroundColor: NAVY, height: 8 }} />
			{/* Centered content */}
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px 6px', height: 'calc(100% - 8px)' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
					{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />}
					<div style={{ fontSize: 7, color: NAVY, fontFamily: '"Georgia", serif', letterSpacing: 2 }}>{p.schoolName.toUpperCase()}</div>
				</div>
				<Photo url={p.photoUrl} name={p.fullName} w={62} h={78} border={MAROON} />
				<div style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>{name}</div>
				<div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 3 }}>
					<span style={{ fontSize: 7.5, color: '#fff', backgroundColor: MAROON, padding: '1px 8px', borderRadius: 2, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>{p.personType}</span>
				</div>
				<div style={{ marginTop: 'auto', display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }}>
					<span style={{ fontSize: 7, color: '#888', fontFamily: 'system-ui' }}>{p.academicYear}</span>
					<span style={{ fontSize: 9, fontWeight: 700, color: NAVY, fontFamily: 'system-ui' }}>ID: {p.sisId}</span>
				</div>
			</div>
		</Shell>
	)
}
export function Design7Back(p: CardDesignProps) { return <BackLayout props={p} variant="cream" /> }

/* ================================================================
 * DESIGN 8: "Sidebar Accent" — Bold navy left sidebar, role vertical
 * ================================================================ */
export function Design8Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg="#FFFFFF">
			<WM logoUrl={p.logoUrl} opacity={0.02} />
			<div style={{ display: 'flex', height: '100%' }}>
				{/* Left navy sidebar */}
				<div style={{ width: 42, backgroundColor: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
					{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />}
					<div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 7, color: '#ffffff88', fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 3 }}>{p.personType}</div>
					<div style={{ width: 16, height: 2, backgroundColor: MAROON }} />
				</div>
				{/* Thin maroon divider */}
				<div style={{ width: 3, backgroundColor: MAROON }} />
				{/* Right content */}
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 14px 8px' }}>
					<div style={{ fontSize: 7, color: '#999', fontFamily: '"Georgia", serif', letterSpacing: 1.5 }}>{p.schoolName.toUpperCase()}</div>
					<div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 12, marginTop: 6 }}>
						<Photo url={p.photoUrl} name={p.fullName} w={68} h={85} border={NAVY} />
						<div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
							<div style={{ fontSize: 15, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.2 }}>{name}</div>
							<div style={{ fontSize: 8, color: '#888', fontFamily: 'system-ui', marginTop: 4 }}>{p.academicYear}</div>
						</div>
					</div>
					<div style={{ borderTop: `1px solid ${NAVY}22`, paddingTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<div style={{ fontSize: 6, color: '#aaa', fontFamily: 'system-ui' }}>ID NUMBER</div>
						<div style={{ fontSize: 11, fontWeight: 700, color: NAVY, fontFamily: 'system-ui', letterSpacing: 0.5 }}>{p.sisId}</div>
					</div>
				</div>
			</div>
		</Shell>
	)
}
export function Design8Back(p: CardDesignProps) { return <BackLayout props={p} /> }

/* ================================================================
 * DESIGN 9: "Heritage Frame" — Cream card, ornamental double border
 * ================================================================ */
export function Design9Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg={CREAM}>
			{/* Outer border effect */}
			<div style={{ position: 'absolute', inset: 6, border: `1.5px solid ${NAVY}33`, borderRadius: 4, pointerEvents: 'none', zIndex: 1 }} />
			<div style={{ position: 'absolute', inset: 10, border: `0.5px solid ${MAROON}44`, borderRadius: 2, pointerEvents: 'none', zIndex: 1 }} />
			<WM logoUrl={p.logoUrl} opacity={0.035} />
			<div style={{ display: 'flex', height: '100%', padding: '18px 20px 14px' }}>
				<div style={{ display: 'flex', alignItems: 'center', marginRight: 14 }}>
					<Photo url={p.photoUrl} name={p.fullName} w={70} h={88} border={NAVY} />
				</div>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
						<div style={{ fontSize: 7, color: NAVY, fontFamily: '"Georgia", serif', letterSpacing: 1.5 }}>{p.schoolName.toUpperCase()}</div>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
						<div style={{ flex: 1, height: 1, backgroundColor: NAVY + '33' }} />
						<div style={{ fontSize: 6, color: MAROON, fontFamily: '"Georgia", serif', fontStyle: 'italic' }}>AMDG</div>
						<div style={{ flex: 1, height: 1, backgroundColor: NAVY + '33' }} />
					</div>
					<div style={{ fontSize: 15, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.2 }}>{name}</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
						<span style={{ fontSize: 8, color: MAROON, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>{p.personType}</span>
						<span style={{ fontSize: 7, color: '#999' }}>•</span>
						<span style={{ fontSize: 8, color: '#888', fontFamily: 'system-ui' }}>{p.academicYear}</span>
					</div>
					<div style={{ marginTop: 6, fontSize: 9, fontWeight: 700, color: NAVY, fontFamily: 'system-ui', letterSpacing: 0.5 }}>ID: {p.sisId}</div>
				</div>
			</div>
		</Shell>
	)
}
export function Design9Back(p: CardDesignProps) { return <BackLayout props={p} variant="cream" /> }

/* ================================================================
 * DESIGN 10: "Split Tone" — Navy left / white right, photo center
 * ================================================================ */
export function Design10Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg="#FFFFFF">
			<div style={{ display: 'flex', height: '100%' }}>
				{/* Navy left half */}
				<div style={{ width: '40%', backgroundColor: NAVY, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '14px 12px 10px' }}>
					<div>
						{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 28, height: 28, objectFit: 'contain', marginBottom: 6 }} />}
						<div style={{ fontSize: 7, color: '#ccc', fontFamily: '"Georgia", serif', letterSpacing: 1.5, lineHeight: 1.4 }}>{p.schoolName.toUpperCase()}</div>
					</div>
					<div>
						<div style={{ fontSize: 6, color: '#888', fontFamily: 'system-ui' }}>ID</div>
						<div style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'system-ui', letterSpacing: 0.5 }}>{p.sisId}</div>
					</div>
				</div>
				{/* Maroon center divider */}
				<div style={{ width: 3, backgroundColor: MAROON }} />
				{/* White right half */}
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 14px 10px', justifyContent: 'space-between' }}>
					<div style={{ display: 'flex', justifyContent: 'center' }}>
						<Photo url={p.photoUrl} name={p.fullName} w={72} h={90} border={NAVY} />
					</div>
					<div style={{ textAlign: 'center' }}>
						<div style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.2 }}>{name}</div>
						<div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', marginTop: 3 }}>
							<span style={{ fontSize: 7.5, color: '#fff', backgroundColor: MAROON, padding: '1px 6px', borderRadius: 2, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>{p.personType}</span>
							<span style={{ fontSize: 7, color: '#888', fontFamily: 'system-ui' }}>{p.academicYear}</span>
						</div>
					</div>
				</div>
			</div>
		</Shell>
	)
}
export function Design10Back(p: CardDesignProps) { return <BackLayout props={p} variant="navy" /> }

/* ================================================================
 * DESIGN 11: "Top Photo Strip" — Wide photo band at top, info below
 * ================================================================ */
export function Design11Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	return (
		<Shell bg="#FFFFFF">
			<WM logoUrl={p.logoUrl} opacity={0.02} />
			{/* Top section: navy band with photo overlay */}
			<div style={{ height: 80, backgroundColor: NAVY, position: 'relative' }}>
				<div style={{ position: 'absolute', left: 16, bottom: -24, zIndex: 2 }}>
					<Photo url={p.photoUrl} name={p.fullName} w={64} h={80} border="#ffffff" />
				</div>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', padding: '0 16px', gap: 6 }}>
					{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
					<div style={{ fontSize: 8, color: '#fff', fontFamily: '"Georgia", serif', letterSpacing: 1.5 }}>{p.schoolName.toUpperCase()}</div>
				</div>
			</div>
			{/* Maroon divider */}
			<div style={{ height: 3, backgroundColor: MAROON }} />
			{/* Bottom info section */}
			<div style={{ display: 'flex', padding: '6px 16px 8px', height: 'calc(100% - 83px)' }}>
				{/* Spacer for photo overhang */}
				<div style={{ width: 72 }} />
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 8 }}>
					<div style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.2 }}>{name}</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
						<span style={{ fontSize: 7.5, color: MAROON, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>{p.personType}</span>
						<span style={{ fontSize: 7, color: '#aaa' }}>|</span>
						<span style={{ fontSize: 7.5, color: '#888', fontFamily: 'system-ui' }}>{p.academicYear}</span>
					</div>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
					<div style={{ fontSize: 6, color: '#aaa', fontFamily: 'system-ui', letterSpacing: 1 }}>ID</div>
					<div style={{ fontSize: 11, fontWeight: 700, color: NAVY, fontFamily: 'system-ui' }}>{p.sisId}</div>
				</div>
			</div>
		</Shell>
	)
}
export function Design11Back(p: CardDesignProps) { return <BackLayout props={p} /> }

/* ================================================================
 * DESIGN 12: "Monogram Shield" — Large faded initial as BG element
 * ================================================================ */
export function Design12Front(p: CardDesignProps) {
	const { NAVY, MAROON, CREAM } = getColors(p)
	const name = getFirstAndLastName(p.fullName).toUpperCase()
	const initial = name.charAt(0)
	return (
		<Shell bg="#FFFFFF">
			{/* Giant faded monogram initial */}
			<div style={{ position: 'absolute', right: -10, top: -20, fontSize: 180, fontWeight: 700, color: NAVY, opacity: 0.04, fontFamily: '"Georgia", serif', lineHeight: 1, pointerEvents: 'none', zIndex: 0 }}>{initial}</div>
			<WM logoUrl={p.logoUrl} opacity={0.02} />
			{/* Maroon top */}
			<div style={{ height: 4, backgroundColor: MAROON }} />
			{/* Navy thin secondary line */}
			<div style={{ height: 1.5, backgroundColor: NAVY }} />
			<div style={{ display: 'flex', height: 'calc(100% - 5.5px)', padding: '10px 16px 8px' }}>
				<div style={{ display: 'flex', alignItems: 'center', marginRight: 14 }}>
					<Photo url={p.photoUrl} name={p.fullName} w={70} h={88} border={NAVY} />
				</div>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
					<div>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							{p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />}
							<div style={{ fontSize: 7, color: NAVY, fontFamily: '"Georgia", serif', letterSpacing: 1.5 }}>{p.schoolName.toUpperCase()}</div>
						</div>
						<div style={{ height: 1.5, backgroundColor: MAROON, marginTop: 6, marginBottom: 8, width: 50 }} />
						<div style={{ fontSize: 16, fontWeight: 700, color: NAVY, fontFamily: '"Georgia", serif', lineHeight: 1.15 }}>{name}</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
							<span style={{ fontSize: 8, color: '#fff', backgroundColor: NAVY, padding: '1.5px 8px', borderRadius: 2, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>{p.personType}</span>
							<span style={{ fontSize: 8, color: '#888', fontFamily: 'system-ui' }}>{p.academicYear}</span>
						</div>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
						<div>
							<div style={{ fontSize: 6, color: '#bbb', fontFamily: 'system-ui', letterSpacing: 1 }}>ID NUMBER</div>
							<div style={{ fontSize: 11, fontWeight: 700, color: NAVY, fontFamily: 'system-ui', letterSpacing: 0.5 }}>{p.sisId}</div>
						</div>
						<div style={{ fontSize: 6, color: '#ccc', fontFamily: '"Georgia", serif', fontStyle: 'italic' }}>AMDG</div>
					</div>
				</div>
			</div>
		</Shell>
	)
}
export function Design12Back(p: CardDesignProps) { return <BackLayout props={p} /> }

/** All 12 designs */
export const DESIGNS = [
	{ id: 1, name: 'Classic Band', desc: 'Navy top/bottom bands, cream body, centered school identity', Front: Design1Front, Back: Design1Back },
	{ id: 2, name: 'Full-Height Photo', desc: 'Photo spans full right edge, gradient left column', Front: Design2Front, Back: Design2Back },
	{ id: 3, name: 'Light Executive', desc: 'Design 4 layout (photo-left, structured info) with Design 5 colors (white bg, thin maroon accent)', Front: Design3Front, Back: Design3Back },
	{ id: 4, name: 'Dark Executive', desc: 'Navy card with white text, premium feel', Front: Design4Front, Back: Design4Back },
	{ id: 5, name: 'Modern Minimal', desc: 'Clean white card, structured data fields, thin accents', Front: Design5Front, Back: Design5Back },
	{ id: 6, name: 'Ribbon Banner', desc: 'Maroon ribbon band across center separating identity from details', Front: Design6Front, Back: Design6Back },
	{ id: 7, name: 'Centered Portrait', desc: 'Symmetrical layout with centered photo and cream background', Front: Design7Front, Back: Design7Back },
	{ id: 8, name: 'Sidebar Accent', desc: 'Bold navy left sidebar with vertical role text', Front: Design8Front, Back: Design8Back },
	{ id: 9, name: 'Heritage Frame', desc: 'Cream card with ornamental double-border frame', Front: Design9Front, Back: Design9Back },
	{ id: 10, name: 'Split Tone', desc: 'Navy left half, white right half, centered photo', Front: Design10Front, Back: Design10Back },
	{ id: 11, name: 'Top Photo Strip', desc: 'Navy header band with overlapping photo, info below', Front: Design11Front, Back: Design11Back },
	{ id: 12, name: 'Monogram Shield', desc: 'Large faded initial as background element, navy badge', Front: Design12Front, Back: Design12Back },
] as const
