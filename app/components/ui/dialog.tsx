import * as React from 'react'
import { cn } from '#app/utils/misc.tsx'
import { Button } from './button.tsx'
import { Icon } from './icon.tsx'

interface DialogContextValue {
	open: boolean
	setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | undefined>(
	undefined,
)

interface DialogProps {
	children: React.ReactNode
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

const Dialog = ({
	children,
	open: controlledOpen,
	onOpenChange,
}: DialogProps) => {
	const [internalOpen, setInternalOpen] = React.useState(false)
	const open = controlledOpen ?? internalOpen
	const setOpen = React.useCallback(
		(value: boolean) => {
			if (controlledOpen === undefined) {
				setInternalOpen(value)
			}
			onOpenChange?.(value)
		},
		[controlledOpen, onOpenChange],
	)

	// Close on Escape key
	React.useEffect(() => {
		if (!open) return
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setOpen(false)
			}
		}
		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [open, setOpen])

	return (
		<DialogContext.Provider value={{ open, setOpen }}>
			{children}
		</DialogContext.Provider>
	)
}

const useDialogContext = () => {
	const context = React.useContext(DialogContext)
	if (!context) {
		throw new Error('Dialog components must be used within a Dialog')
	}
	return context
}

interface DialogTriggerProps {
	children: React.ReactNode
	asChild?: boolean
}

const DialogTrigger = ({ children, asChild }: DialogTriggerProps) => {
	const { setOpen } = useDialogContext()

	if (asChild && React.isValidElement(children)) {
		return React.cloneElement(children, {
			onClick: (e: React.MouseEvent) => {
				setOpen(true)
				if (
					children &&
					typeof children === 'object' &&
					'props' in children &&
					children.props &&
					typeof children.props === 'object' &&
					'onClick' in children.props &&
					typeof children.props.onClick === 'function'
				) {
					children.props.onClick(e)
				}
			},
		} as any)
	}

	return (
		<button type="button" onClick={() => setOpen(true)}>
			{children}
		</button>
	)
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
	({ className, children, ...props }, ref) => {
		const { open, setOpen } = useDialogContext()
		const contentRef = React.useRef<HTMLDivElement>(null)

		// Focus trap and initial focus
		React.useEffect(() => {
			if (!open) return
			if (!open || !contentRef.current) return

			const dialog = contentRef.current
			const focusableElements = dialog.querySelectorAll(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			)

			if (focusableElements.length === 0) return

			const firstElement = focusableElements[0] as HTMLElement
			const lastElement = focusableElements[
				focusableElements.length - 1
			] as HTMLElement

			// Focus first element after a short delay to ensure dialog is rendered
			const focusTimeout = setTimeout(() => {
				firstElement?.focus()
			}, 0)

			const handleTab = (e: KeyboardEvent) => {
				if (e.key !== 'Tab') return

				const activeElement = document.activeElement

				if (e.shiftKey) {
					// Shift + Tab
					if (activeElement === firstElement) {
						e.preventDefault()
						lastElement?.focus()
					}
				} else {
					// Tab
					if (activeElement === lastElement) {
						e.preventDefault()
						firstElement?.focus()
					}
				}
			}

			document.addEventListener('keydown', handleTab)
			return () => {
				clearTimeout(focusTimeout)
				document.removeEventListener('keydown', handleTab)
			}
		}, [open])

		const handleBackdropClick = (e: React.MouseEvent) => {
			// Only close if clicking directly on the backdrop, not on dialog content
			if (e.target === e.currentTarget) {
				setOpen(false)
			}
		}

		const handleContentClick = (e: React.MouseEvent) => {
			// Prevent clicks inside dialog from bubbling to backdrop
			e.stopPropagation()
		}

		if (!open) return null

		return (
			<>
				<div
					className="fixed inset-0 z-50 bg-black/80"
					onClick={handleBackdropClick}
					aria-hidden="true"
				/>
				<div
					ref={ref || contentRef}
					className={cn(
						'bg-background fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border shadow-lg',
						className,
					)}
					role="dialog"
					aria-modal="true"
					onClick={handleContentClick}
					{...props}
				>
					{children}
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-4 right-4"
						onClick={() => setOpen(false)}
						aria-label="Close dialog"
					>
						<Icon name="cross-1" className="size-4" />
						<span className="sr-only">Close</span>
					</Button>
				</div>
			</>
		)
	},
)
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn('flex flex-col space-y-1.5 p-6 pb-4', className)}
		{...props}
	/>
)
DialogHeader.displayName = 'DialogHeader'

const DialogTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h2
		ref={ref}
		className={cn(
			'text-lg leading-none font-semibold tracking-tight',
			className,
		)}
		{...props}
	/>
))
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn('text-muted-foreground text-sm', className)}
		{...props}
	/>
))
DialogDescription.displayName = 'DialogDescription'

const DialogFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			'flex flex-col-reverse p-6 pt-4 sm:flex-row sm:justify-end sm:space-x-2',
			className,
		)}
		{...props}
	/>
)
DialogFooter.displayName = 'DialogFooter'

export {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
}
