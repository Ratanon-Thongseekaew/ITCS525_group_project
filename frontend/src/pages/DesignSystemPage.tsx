import { useId, type ReactNode } from 'react'
import {
  Bold,
  Check,
  Info,
  Italic,
  Mail,
  Plus,
  Recycle,
  Sparkles,
  TriangleAlert,
  Underline,
  Wrench,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { SortActionButton } from '@/components/staff/SortActionButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type PanelTheme = 'light' | 'dark'

const COLOR_TOKENS = [
  ['background', 'bg-background', 'text-foreground'],
  ['card', 'bg-card', 'text-card-foreground'],
  ['popover', 'bg-popover', 'text-popover-foreground'],
  ['primary', 'bg-primary', 'text-primary-foreground'],
  ['secondary', 'bg-secondary', 'text-secondary-foreground'],
  ['muted', 'bg-muted', 'text-muted-foreground'],
  ['accent', 'bg-accent', 'text-accent-foreground'],
  ['destructive', 'bg-destructive', 'text-white'],
  ['border', 'bg-border', 'text-foreground'],
  ['input', 'bg-input', 'text-foreground'],
  ['ring', 'bg-ring', 'text-foreground'],
] as const

const BIN_TYPE_TOKENS = [
  ['resale', 'bg-resale text-resale-foreground', 'bg-resale-soft text-resale-soft-foreground'],
  ['recycle', 'bg-recycle text-recycle-foreground', 'bg-recycle-soft text-recycle-soft-foreground'],
  ['repair', 'bg-repair text-repair-foreground', 'bg-repair-soft text-repair-soft-foreground'],
] as const

const CHART_TOKENS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'] as const

const SAMPLE_BINS = [
  { code: 'RB-1042', site: 'Bangkok', weight: '18.4 kg', status: 'Approved' },
  { code: 'RB-1043', site: 'Chiang Mai', weight: '22.0 kg', status: 'Disputed' },
  { code: 'RB-1044', site: 'Bangkok', weight: '15.7 kg', status: 'Awaiting pickup' },
] as const

const STATUS_VARIANT = {
  Approved: 'success',
  Disputed: 'warning',
  'Awaiting pickup': 'info',
} as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * Every primitive in one theme. Popups render in a portal outside the panel, so the dark panel
 * passes `dark` to each popup's content to keep it in the panel's theme.
 */
function ThemePanel({ theme }: { theme: PanelTheme }) {
  const id = useId()
  const popup = theme === 'dark' ? 'dark' : undefined
  const title = theme === 'dark' ? 'Dark' : 'Light'

  return (
    <div
      data-testid={`design-system-${theme}-panel`}
      className={cn(
        theme,
        'min-w-0 space-y-8 rounded-xl border bg-background p-4 text-foreground sm:p-6',
      )}
    >
      <h2 className="text-xl font-semibold">{title} theme</h2>

      <Section title="Color tokens">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COLOR_TOKENS.map(([name, bg, fg]) => (
            <div key={name} className={cn('rounded-md border p-3 text-xs font-medium', bg, fg)}>
              {name}
            </div>
          ))}
        </div>
        <div className="flex gap-2" aria-label="Chart colors">
          {CHART_TOKENS.map((bg, index) => (
            <div
              key={bg}
              className={cn('flex h-10 flex-1 items-end rounded-md p-1 text-[10px] text-white', bg)}
            >
              chart-{index + 1}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Bin types">
        <p className="text-xs text-muted-foreground">
          Categories, not statuses: solid for quick-tap buttons, soft for badges and alerts.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {BIN_TYPE_TOKENS.map(([name, solid, soft]) => (
            <div key={name} className="grid gap-1 text-xs font-medium">
              <div className={cn('rounded-md p-3', solid)}>{name}</div>
              <div className={cn('rounded-md p-3', soft)}>{name}-soft</div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SortActionButton
            type="resale"
            icon={<Sparkles />}
            label="Resale"
            hint="Solid quick-tap button"
            shortcut="[R]"
            onClick={() => {}}
          />
          <SortActionButton
            type="recycle"
            icon={<Recycle />}
            label="Recycle"
            hint="Solid quick-tap button"
            shortcut="[C]"
            onClick={() => {}}
          />
          <SortActionButton
            type="repair"
            icon={<Wrench />}
            label="Repair"
            hint="Solid quick-tap button"
            shortcut="[U]"
            onClick={() => {}}
          />
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight">Page title, text-2xl</p>
          <p className="text-lg font-semibold">Section title, text-lg</p>
          <p className="text-sm">Body text, text-sm with text-foreground.</p>
          <p className="text-sm text-muted-foreground">
            Supporting text, text-sm with text-muted-foreground.
          </p>
          <a
            href="#tokens"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Inline link, text-primary
          </a>
        </div>
      </Section>

      <Section title="Button">
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Add">
            <Plus />
          </Button>
          <Button>
            <Mail /> With icon
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input id={`${id}-email`} type="email" placeholder="staff@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-invalid`}>Weight (kg)</Label>
            <Input id={`${id}-invalid`} aria-invalid defaultValue="-3" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-site`}>Site</Label>
            <Select defaultValue="bkk">
              <SelectTrigger id={`${id}-site`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={popup}>
                <SelectItem value="bkk">Bangkok Sorting Center</SelectItem>
                <SelectItem value="cnx">Chiang Mai Sorting Center</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-disabled`}>Disabled</Label>
            <Input id={`${id}-disabled`} disabled placeholder="Not editable" />
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-revenue`}>Potential revenue</FieldLabel>
            <InputGroup>
              <InputGroupInput id={`${id}-revenue`} type="number" defaultValue="15000" />
              <InputGroupAddon align="inline-end">
                <InputGroupText>฿</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>Field with an input group addon.</FieldDescription>
          </Field>
          <Field data-invalid>
            <FieldLabel htmlFor={`${id}-driver`}>Driver weight (kg)</FieldLabel>
            <Input id={`${id}-driver`} aria-invalid defaultValue="" />
            <FieldError>Enter the driver's weight.</FieldError>
          </Field>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={`${id}-notes`}>Notes</Label>
            <Textarea id={`${id}-notes`} placeholder="Optional notes" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox id={`${id}-check`} defaultChecked />
            <Label htmlFor={`${id}-check`}>Include photos</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`${id}-switch`} defaultChecked />
            <Label htmlFor={`${id}-switch`}>Notify contractor</Label>
          </div>
        </div>
        <RadioGroup defaultValue="resale" className="flex flex-wrap gap-4">
          {['resale', 'recycle', 'repair'].map((value) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${value}`} value={value} />
              <Label htmlFor={`${id}-${value}`} className="capitalize">
                {value}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <ToggleGroup type="multiple" variant="outline" aria-label="Text style">
          <ToggleGroupItem value="bold" aria-label="Bold">
            <Bold />
          </ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label="Italic">
            <Italic />
          </ToggleGroupItem>
          <ToggleGroupItem value="underline" aria-label="Underline">
            <Underline />
          </ToggleGroupItem>
        </ToggleGroup>
      </Section>

      <Section title="Card">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly outcome report</CardTitle>
            <CardDescription>October 2026, Bangkok Sorting Center</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">1,284 kg processed across 6 dispositions.</CardContent>
          <CardFooter className="gap-2">
            <Button size="sm">View report</Button>
            <Button size="sm" variant="outline">
              Export
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Alert">
        <div className="grid gap-3">
          <Alert>
            <Info />
            <AlertTitle>Default</AlertTitle>
            <AlertDescription>Neutral information.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <X />
            <AlertTitle>Destructive</AlertTitle>
            <AlertDescription>The report could not be imported.</AlertDescription>
          </Alert>
          <Alert variant="success">
            <Check />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Handoff recorded.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>Weights differ by more than 3%.</AlertDescription>
          </Alert>
          <Alert variant="info">
            <Info />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>Pickup scheduled for tomorrow.</AlertDescription>
          </Alert>
          <Alert variant="resale" role="status">
            <Check />
            <AlertTitle>Resale</AlertTitle>
            <AlertDescription>Item sorted into BIN-RS-004.</AlertDescription>
          </Alert>
          <Alert variant="recycle" role="status">
            <Check />
            <AlertTitle>Recycle</AlertTitle>
            <AlertDescription>Item sorted into BIN-RC-002.</AlertDescription>
          </Alert>
          <Alert variant="repair" role="status">
            <Check />
            <AlertTitle>Repair</AlertTitle>
            <AlertDescription>Item sorted into BIN-RP-001.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="resale">Resale</Badge>
          <Badge variant="recycle">Recycle</Badge>
          <Badge variant="repair">Repair</Badge>
        </div>
      </Section>

      <Section title="Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>Operations</BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Direct Resale</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">Processed Bin Records</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Section>

      <Section title="Table">
        <Table>
          <TableCaption>Recycle bins awaiting handoff.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Bin</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_BINS.map((bin) => (
              <TableRow key={bin.code}>
                <TableCell className="font-medium">{bin.code}</TableCell>
                <TableCell>{bin.site}</TableCell>
                <TableCell className="text-right tabular-nums">{bin.weight}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[bin.status]}>{bin.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">
            Overview content.
          </TabsContent>
          <TabsContent value="records" className="text-sm text-muted-foreground">
            Records content.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Progress and skeleton">
        <Progress value={62} aria-label="Import progress" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </Section>

      <Section title="Empty">
        <EmptyState>No bins awaiting handoff.</EmptyState>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent className={popup}>
              <DialogHeader>
                <DialogTitle>Confirm handoff</DialogTitle>
                <DialogDescription>
                  Record bin RB-1042 as picked up by the contractor.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Confirm</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Open alert dialog</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className={popup}>
              <AlertDialogHeader>
                <AlertDialogTitle>Seal and close bin?</AlertDialogTitle>
                <AlertDialogDescription>
                  The bin stops accepting items and becomes ready for handoff.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Confirm & Seal</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className={popup}>
              <DropdownMenuLabel>Bin actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>View details</DropdownMenuItem>
              <DropdownMenuItem>Print label</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover for tooltip</Button>
            </TooltipTrigger>
            <TooltipContent className={popup}>Tooltips use the primary color.</TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={() => toast.success('Handoff recorded')}>
            Show toast
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Toasts follow the app theme, which stays light until dark mode is turned on.
        </p>
      </Section>
    </div>
  )
}

/** Unlisted reference for the design system: tokens and every primitive, in light and dark. */
export function DesignSystemPage() {
  return (
    <main className="min-h-screen min-h-svh bg-muted px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header id="tokens" className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Textile Track design system</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            shadcn/ui primitives from <code>src/components/ui</code> on the neutral theme, with
            teal-700 as the primary color (teal-400 in dark mode). Build new UI from these
            components and theme tokens.
          </p>
        </header>

        <Card>
          <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">Do</p>
              <p className="text-muted-foreground">
                Use <code>Button</code>, <code>Select</code>, <code>Table</code>, <code>Alert</code>{' '}
                and <code>Badge</code> with tokens like <code>bg-card</code>,{' '}
                <code>text-muted-foreground</code> and <code>border</code>.
              </p>
            </div>
            <div>
              <p className="font-medium text-destructive">Don&apos;t</p>
              <p className="text-muted-foreground">
                Use raw <code>&lt;button&gt;</code> or <code>&lt;select&gt;</code>, or palette
                classes like <code>bg-white</code> and <code>text-slate-500</code>, except in status
                variants.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="grid gap-6 lg:grid-cols-2">
          <ThemePanel theme="light" />
          <ThemePanel theme="dark" />
        </div>
      </div>
    </main>
  )
}
