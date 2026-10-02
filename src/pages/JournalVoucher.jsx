import { useEffect, useState } from 'react'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import { Table, Pagination } from '../components/ui/Table.jsx'
import Modal from '../components/ui/Modal.jsx'
import Input, { Textarea } from '../components/ui/Input.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import { formatDate, todayISO } from '../utils/formatters.js'
import { useSettingsStore } from '../store/useSettingsStore.js'

function newEntry() { return { _key: Math.random(), account: '', debit: '', credit: '' } }

export default function JournalVoucher() {
  const { showToast } = useSettingsStore()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({ voucher_date: todayISO(), narration: '' })
  const [entries, setEntries] = useState([newEntry(), newEntry()])
  const limit = 20

  useEffect(() => { fetchData() }, [page])
  async function fetchData() {
    setLoading(true)
    const res = await window.api.journals.getAll({ page, limit })
    if (res.success) { setData(res.data); setTotal(res.total) }
    setLoading(false)
  }

  function updateEntry(idx, field, value) { setEntries(p => p.map((e, i) => i === idx ? { ...e, [field]: value } : e)) }

  const totalDebit  = entries.reduce((s, e) => s + parseFloat(e.debit || 0), 0)
  const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit || 0), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01

  async function handleSave() {
    if (!balanced) { showToast('Debit and Credit must be equal', 'error'); return }
    if (!form.voucher_date) { showToast('Date required', 'error'); return }
    setSaving(true)
    const res = await window.api.journals.create({ ...form, entries: entries.filter(e => e.account) })
    setSaving(false)
    if (res.success) { showToast('Journal voucher saved', 'success'); setModal(false); setEntries([newEntry(), newEntry()]); setForm({ voucher_date: todayISO(), narration: '' }); fetchData() }
    else showToast(res.error, 'error')
  }

  const columns = [
    { key: 'voucher_number', label: 'Voucher No', render: v => <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{v}</span> },
    { key: 'voucher_date', label: 'Date', render: v => formatDate(v) },
    { key: 'narration', label: 'Narration', render: v => v || '-' },
    { key: 'id', label: '', render: (v, row) => <button onClick={() => setDeleteTarget(row)} className="text-red-500 p-1"><Trash2 size={14} /></button> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={22} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Journal Vouchers</h2>
        </div>
        <Button icon={Plus} onClick={() => setModal(true)}>New Voucher</Button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <Table columns={columns} data={data} loading={loading} emptyMessage="No journal vouchers yet" />
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => { await window.api.journals.delete(deleteTarget.id); setDeleteTarget(null); fetchData() }} title="Delete Voucher" message="Delete this journal voucher?" />

      <Modal open={modal} onClose={() => setModal(false)} title="New Journal Voucher" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date" type="date" value={form.voucher_date} onChange={e => setForm(p => ({ ...p, voucher_date: e.target.value }))} />
            <Textarea label="Narration" value={form.narration} onChange={e => setForm(p => ({ ...p, narration: e.target.value }))} rows={1} />
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-100 dark:bg-gray-700">
              <th className="px-3 py-2 text-left">Account / Ledger</th>
              <th className="px-3 py-2 text-right">Debit (Dr)</th>
              <th className="px-3 py-2 text-right">Credit (Cr)</th>
              <th></th>
            </tr></thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry._key} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="px-2 py-1"><input className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-100" value={entry.account} onChange={e => updateEntry(idx, 'account', e.target.value)} placeholder="e.g. Cash, Bank, Sales..." /></td>
                  <td className="px-2 py-1"><input className="w-28 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-right bg-white dark:bg-gray-700 dark:text-gray-100" type="number" value={entry.debit} onChange={e => updateEntry(idx, 'debit', e.target.value)} /></td>
                  <td className="px-2 py-1"><input className="w-28 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-right bg-white dark:bg-gray-700 dark:text-gray-100" type="number" value={entry.credit} onChange={e => updateEntry(idx, 'credit', e.target.value)} /></td>
                  <td className="px-2 py-1"><button onClick={() => setEntries(p => p.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 size={13} /></button></td>
                </tr>
              ))}
              <tr className="font-semibold bg-gray-50 dark:bg-gray-700/50">
                <td className="px-3 py-2">Total</td>
                <td className={`px-3 py-2 text-right ${!balanced ? 'text-red-600' : 'text-green-600'}`}>{totalDebit.toFixed(2)}</td>
                <td className={`px-3 py-2 text-right ${!balanced ? 'text-red-600' : 'text-green-600'}`}>{totalCredit.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          {!balanced && <p className="text-red-600 text-sm">⚠ Debit and Credit must balance</p>}
          <button onClick={() => setEntries(p => [...p, newEntry()])} className="text-sm text-indigo-600 flex items-center gap-1"><Plus size={13} /> Add Row</button>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave} disabled={!balanced}>Save Voucher</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
