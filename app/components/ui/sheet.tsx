import * as React from 'react'
import { Icon } from './icon.tsx'
import { Button } from './button.tsx'
import { cn } from '#app/utils/misc.tsx'

interface SheetContextValue {
	open: boolean
	setOpen: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | undefined>(
	undefined,
)

interface SheetProps {
	children: React.ReactNode
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

const Sheet = ({
	children,
	open: controlledOpen,
	onOpenChange,
}: SheetProps) => {
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

	return (
		<SheetContext.Provider value={{ open, setOpen }}>
			{children}
		</SheetContext.Provider>
	)
}

const useSheetContext = () => {
	const context = React.useContext(SheetContext)
	if (!context) {
		throw new Error('Sheet components must be used within a Sheet')
	}
	return context
}

interface SheetTriggerProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
	({ asChild, children, ...props }, ref) => {
		const { setOpen } = useSheetContext()
		if (asChild && React.isValidElement(children)) {
			return React.cloneElement(children, {
				onClick: () => setOpen(true),
				...props,
			} as any)
		}
		return (
			<Button ref={ref} onClick={() => setOpen(true)} {...props}>
				{children}
			</Button>
		)
	},
)
SheetTrigger.displayName = 'SheetTrigger'

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
	side?: 'left' | 'right' | 'top' | 'bottom'
	children: React.ReactNode
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
	({ side = 'right', className, children, ...props }, ref) => {
		const { open, setOpen } = useSheetContext()

		if (!open) return null

		return (
			<>
				<div
					className="fixed inset-0 z-50 bg-black/80"
					onClick={() => setOpen(false)}
					aria-hidden="true"
				/>
				<div
					ref={ref}
					className={cn(
						'bg-background fixed z-50 gap-4 p-6 shadow-lg',
						side === 'right' &&
							'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
						side === 'left' &&
							'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
						side === 'top' && 'inset-x-0 top-0 border-b',
						side === 'bottom' && 'inset-x-0 bottom-0 border-t',
						className,
					)}
					{...props}
				>
					{children}
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-4 right-4"
						onClick={() => setOpen(false)}
					>
						<Icon name="cross" className="size-4" />
						<span className="sr-only">Close</span>
					</Button>
				</div>
			</>
		)
	},
)
SheetContent.displayName = 'SheetContent'

const SheetHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			'flex flex-col space-y-2 text-center sm:text-left',
			className,
		)}
		{...props}
	/>
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
			className,
		)}
		{...props}
	/>
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h2
		ref={ref}
		className={cn('text-foreground text-lg font-semibold', className)}
		{...props}
	/>
))
SheetTitle.displayName = 'SheetTitle'

const SheetDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn('text-muted-foreground text-sm', className)}
		{...props}
	/>
))
SheetDescription.displayName = 'SheetDescription'

export {
	Sheet,
	SheetTrigger,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
}
