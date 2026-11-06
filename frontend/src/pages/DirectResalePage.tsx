import { useState } from 'react'
import { Archive, Calculator, Check, ClipboardList, Shirt, X } from 'lucide-react'
import { Link } from 'react-router'
import { DirectResaleBinRow } from '@/components/staff/DirectResaleBinRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { directResaleBins, type DirectResaleBin } from '@/lib/mock-direct-resale-bins'

export function DirectResalePage() {
  const [bins, setBins] = useState(directResaleBins)
  const [activeBin, setActiveBin] = useState<DirectResaleBin | null>(null)
  const [accepted, setAccepted] = useState('98')
  const [rejected, setRejected] = useState('2')
  const [revenue, setRevenue] = useState('15000')
  const [notes, setNotes] = useState('')
  const [keypadOpen, setKeypadOpen] = useState(false)

  const awaiting = bins.filter((bin) => bin.status === 'Awaiting Process')
  const processed = bins.filter((bin) => bin.status === 'Processed')

  function openProcess(bin: DirectResaleBin) {
    setActiveBin(bin)
    setAccepted(String(bin.count - 2))
    setRejected('2')
    setRevenue('15000')
    setNotes('')
  }

  function confirmProcess() {
    if (!activeBin) return
    setBins((current) =>
      current.map((bin) =>
        bin.id === activeBin.id ? { ...bin, status: 'Processed', revenue: Number(revenue) } : bin,
      ),
    )
    setActiveBin(null)
  }

  return (
    <div className="resale-workspace">
      <div className="resale-main">
        <div className="resale-topline">
          <div>
            <span>Operations</span>
            <span className="resale-slash">/</span>
            <strong>Direct Resale</strong>
          </div>
        </div>
        <header className="resale-heading">
          <div>
            <h1>Direct Resale Bins</h1>
            <p>Tap to process resale bin and record potential revenue</p>
          </div>
          <div className="resale-heading__actions">
            <Button asChild variant="outline">
              <Link to="/staff/direct-resale/potential-revenue-analysis">
                <ClipboardList /> Potential Revenue Analysis
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/staff/direct-resale/processed-bins-record">
                <Archive /> Processed Bin Records
              </Link>
            </Button>
          </div>
        </header>

        <section className="resale-summary">
          <h2>Summary</h2>
          <div className="resale-metrics">
            <article>
              <span>Bins Awaiting</span>
              <strong>{awaiting.length}</strong>
            </article>
            <article>
              <span>Items Staged</span>
              <strong>{awaiting.reduce((sum, bin) => sum + bin.count, 0)}</strong>
            </article>
            <article>
              <span>Total Grossed Weight</span>
              <strong>{awaiting.reduce((sum, bin) => sum + bin.weight, 0)} kg</strong>
            </article>
            <article>
              <span>Bins Processed Today</span>
              <strong>{processed.length + 3}</strong>
            </article>
          </div>
        </section>
        <section className="resale-bins">
          <h2>Bins awaiting process</h2>
          {awaiting.length ? (
            awaiting.map((bin) => (
              <DirectResaleBinRow bin={bin} key={bin.id} onSelect={() => openProcess(bin)} />
            ))
          ) : (
            <div className="resale-empty">No bins in this list.</div>
          )}
          <p className="resale-record-count">
            Showing {awaiting.length} of {awaiting.length} records
          </p>
        </section>
      </div>

      {activeBin && (
        <div
          className="resale-overlay"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setActiveBin(null)}
        >
          <section
            className="resale-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="process-title"
          >
            <header>
              <h2 id="process-title">Process Resale Bin</h2>
              <button aria-label="Close" onClick={() => setActiveBin(null)} type="button">
                <X />
              </button>
            </header>
            <div className="resale-dialog__body">
              <div className="resale-bin-preview">
                <Shirt />
                <div className="resale-bin-preview__identity">
                  <strong>#{activeBin.id}</strong>
                  <b>Resale Bin</b>
                </div>
                <div>
                  <small>Item Count</small>
                  <strong>{activeBin.count} items</strong>
                </div>
                <div>
                  <small>Grossed Weight</small>
                  <strong>{activeBin.weight}kg</strong>
                </div>
                <p>Packed at&nbsp; {activeBin.packed}</p>
              </div>
              <div className="resale-form-grid">
                <label>
                  Accepted Item Count
                  <Input
                    type="number"
                    min="0"
                    value={accepted}
                    onChange={(event) => setAccepted(event.target.value)}
                  />
                </label>
                <label>
                  Rejected Item Count
                  <Input
                    className="resale-rejected-input"
                    type="number"
                    min="0"
                    value={rejected}
                    onChange={(event) => setRejected(event.target.value)}
                  />
                </label>
                <label>
                  Potential Revenue
                  <div className="resale-currency">
                    <Input
                      type="number"
                      min="0"
                      value={revenue}
                      onChange={(event) => setRevenue(event.target.value)}
                    />
                    <span>฿</span>
                  </div>
                </label>
                <label>
                  Or Use Running-Sum Keypad
                  <Button
                    className="resale-keypad-trigger"
                    variant="secondary"
                    onClick={() => setKeypadOpen(!keypadOpen)}
                  >
                    <Calculator /> {keypadOpen ? 'Close' : 'Open'}
                  </Button>
                </label>
                {keypadOpen && (
                  <div className="resale-keypad" aria-label="Running-sum keypad">
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '+'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          key === 'C'
                            ? setRevenue('0')
                            : key === '+'
                              ? undefined
                              : setRevenue((current) => `${current === '0' ? '' : current}${key}`)
                        }
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                )}
                <label>
                  Process Date
                  <div className="resale-date">
                    <span>▦</span>
                    <Input type="date" defaultValue="2026-10-20" />
                  </div>
                </label>
                <label>
                  Notes <span className="resale-muted">(Optional)</span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>
              </div>
              <p className="resale-validation">
                Accepted and rejected item counts should total {activeBin.count} items.
              </p>
            </div>
            <footer>
              <Button
                className="resale-confirm"
                disabled={Number(accepted) + Number(rejected) !== activeBin.count}
                onClick={confirmProcess}
              >
                <Check /> Confirm
              </Button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
