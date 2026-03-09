/**
 * 5 ID Card Design Variants addressing the design critique
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
}

const NAVY = '#1B2A4A'
const MAROON = '#8B1A2B'
const CREAM = '#F5F0E8'
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

function Photo({ url, name, w = 72, h = 90, border = NAVY }: { url: string | null; name: string; w?: number; h?: number; border?: string }) {
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

const SCHOOL_ADDRESS_LINE1 = '1522 Carmel Dr.'
const SCHOOL_ADDRESS_LINE2 = 'Lafayette, LA 70501'
const SCHOOL_PHONE = '337-889-5345'

function BackLayout({ props, variant = 'default' }: { props: CardDesignProps; variant?: string }) {
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

/** All 5 designs */
export const DESIGNS = [
	{ id: 1, name: 'Classic Band', desc: 'Navy top/bottom bands, cream body, centered school identity', Front: Design1Front, Back: Design1Back },
	{ id: 2, name: 'Full-Height Photo', desc: 'Photo spans full right edge, gradient left column', Front: Design2Front, Back: Design2Back },
	{ id: 3, name: 'Light Executive', desc: 'Design 4 layout (photo-left, structured info) with Design 5 colors (white bg, thin maroon accent)', Front: Design3Front, Back: Design3Back },
	{ id: 4, name: 'Dark Executive', desc: 'Navy card with white text, premium feel', Front: Design4Front, Back: Design4Back },
	{ id: 5, name: 'Modern Minimal', desc: 'Clean white card, structured data fields, thin accents', Front: Design5Front, Back: Design5Back },
] as const
