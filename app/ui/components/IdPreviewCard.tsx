import { useState } from 'react'
import { Button } from '#app/components/ui/button.tsx'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '#app/components/ui/dialog.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { cn } from '#app/utils/misc.tsx'

interface IdPreviewCardProps {
	title: string
	children: React.ReactNode
	previewContent: React.ReactNode
	className?: string
}

export function IdPreviewCard({
	title,
	children,
	previewContent,
	className,
}: IdPreviewCardProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [imageError, setImageError] = useState(false)

	return (
		<>
			<div
				className={cn(
					'group relative cursor-pointer transition-all hover:shadow-md',
					className,
				)}
				onClick={() => setIsOpen(true)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault()
						setIsOpen(true)
					}
				}}
				role="button"
				tabIndex={0}
				aria-label={`View ${title} in larger view`}
			>
				{imageError ? (
					<div className="bg-muted flex flex-col items-center justify-center rounded-lg border p-8">
						<Icon
							name="cross-1"
							className="text-muted-foreground mb-2 size-8"
						/>
						<p className="text-muted-foreground text-sm">
							Failed to load image
						</p>
						<Button
							variant="outline"
							size="sm"
							className="mt-4"
							onClick={(e) => {
								e.stopPropagation()
								setImageError(false)
							}}
						>
							<Icon name="reset" className="scale-75" />
							Retry
						</Button>
					</div>
				) : (
					<div className="relative">
						{children}
						<div className="bg-background/80 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
							<div className="bg-background rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm">
								Click to enlarge
							</div>
						</div>
					</div>
				)}
			</div>

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="flex max-h-[95vh] min-h-[45vh] w-[95vw] max-w-none flex-col overflow-hidden md:max-w-4xl">
					<DialogHeader className="flex-shrink-0">
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					<div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 md:p-6">
						<div className="flex max-h-[70vh] w-full items-center justify-center md:max-h-[90vh]">
							<div
								className="h-full w-full md:origin-center md:scale-[2]"
								style={{ objectFit: 'contain' }}
							>
								{previewContent}
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
