import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { cn } from '#app/utils/misc.tsx'

interface BulkActionsBarProps {
	selectedCount: number
	onClearSelection: () => void
	actions: Array<{
		label: string
		icon?: string
		onClick: () => void
		variant?: 'default' | 'outline' | 'destructive'
		disabled?: boolean
		isPending?: boolean
	}>
	className?: string
}

export function BulkActionsBar({
	selectedCount,
	onClearSelection,
	actions,
	className,
}: BulkActionsBarProps) {
	if (selectedCount === 0) return null

	return (
		<div
			className={cn(
				'bg-background border-border mb-4 flex items-center justify-between rounded-md border p-3 shadow-sm',
				className,
			)}
		>
			<div className="text-foreground text-sm font-medium">
				{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
			</div>
			<div className="flex items-center gap-2">
				{actions.map((action, index) => {
					const ActionComponent = action.isPending ? StatusButton : Button
					return (
						<ActionComponent
							key={index}
							variant={action.variant || 'default'}
							size="sm"
							onClick={action.onClick}
							disabled={action.disabled}
							status={action.isPending ? 'pending' : 'idle'}
						>
							{action.icon && <Icon name={action.icon as any} />}
							{action.label}
						</ActionComponent>
					)
				})}
				<button
					type="button"
					onClick={onClearSelection}
					className="text-muted-foreground hover:text-foreground text-sm hover:underline"
				>
					Clear selection
				</button>
			</div>
		</div>
	)
}
