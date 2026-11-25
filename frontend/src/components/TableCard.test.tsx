/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { TableCard } from './TableCard'

afterEach(cleanup)

test('renders the title, actions, table, and footer', () => {
  render(
    <TableCard
      title="Bins"
      description="Open and sealed bins"
      actions={<button type="button">Filter</button>}
      footer="Showing 1 bin"
    >
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>BIN-RS-001</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableCard>,
  )

  expect(screen.getByRole('heading', { name: 'Bins' })).toBeInTheDocument()
  expect(screen.getByText('Open and sealed bins')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: 'BIN-RS-001' })).toBeInTheDocument()
  expect(screen.getByText('Showing 1 bin')).toBeInTheDocument()
})
