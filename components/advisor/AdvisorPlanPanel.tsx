'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import type { AdvisorPlanResult, AdvisorPolicyConfig } from '@/lib/ai/advisor-plan'

const endpoint = '/api/advisor/plan'
type Policy = { version: number; config: AdvisorPolicyConfig }
type Run = { id: string | null; policyVersion: number; stale?: boolean; comparison?: { spent: number; cashAfter: number }; result: AdvisorPlanResult }
type Options = {
  enabled: boolean
  policy: Policy | null
  run: Run | null
  currency: string
  accounts: { id: string; accountName: string }[]
  presets: { id: string; presetName: string; monthlyContribution: string; targetAllocation: unknown }[]
  assets: { id: string; ticker: string; market: string }[]
}
type Review = {
  sampleSize: number
  runs: { id: string; spent: number; baselineAllocated: number | null; durationMs: number }[]
  observations: {
    runId: string; ticker: string
    horizons: { sessionsLater: number; date: string | null; returnPercent: number | null }[]
  }[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'โหลดข้อมูลที่ปรึกษาไม่สำเร็จ')
  return data
}

const inputClass = 'w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white'
const buttonClass = 'rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
const date = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })

export function AdvisorPlanPanel({ edit = false, simulate = false }: { edit?: boolean; simulate?: boolean }) {
  const { data, mutate } = useSWR<Options>(edit ? endpoint + '?options=1' : endpoint, request)
  const [draft, setDraft] = useState<AdvisorPolicyConfig | null>(null)
  const [draftVersion, setDraftVersion] = useState(0)
  const [review, setReview] = useState<Review | null>(null)
  const [scenario, setScenario] = useState<Run | null>(null)
  const [inflow, setInflow] = useState('')
  const [reserve, setReserve] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!data?.enabled) return null
  const policy = data.policy
  const run = scenario ?? data.run
  const amount = (value: number) => value.toLocaleString('th-TH', { maximumFractionDigits: 2 })
  const change = (patch: Partial<AdvisorPolicyConfig>) => setDraft((current) => current ? { ...current, ...patch } : current)

  async function work(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await action() } catch (err) { setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด') }
    finally { setBusy(false) }
  }

  function editPolicy() {
    if (!data) return
    setDraftVersion(policy?.version ?? 0)
    setDraft(policy?.config ?? {
      accountId: data.accounts[0]?.id ?? '', presetId: data.presets[0]?.id ?? '',
      reserve: 0, monthlyBudget: Number(data.presets[0]?.monthlyContribution ?? 0),
      maxPositionPercent: 20, horizonYears: 10, feePercent: 0, feePerOrder: 0, targets: [],
    })
  }

  function submitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void work(async () => {
      await request(endpoint, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: draft, expectedVersion: draftVersion }),
      })
      setDraft(null)
      setScenario(null)
      await mutate()
    })
  }

  function calculate(isSimulation: boolean) {
    void work(async () => {
      if (isSimulation && !inflow.trim()) throw new Error('กรอกยอดเงินใหม่สำหรับการจำลอง')
      const result = await request<{ run: Run }>(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSimulation
          ? { scenario: { inflow: Number(inflow), ...(reserve.trim() ? { reserve: Number(reserve) } : {}) } }
          : {}),
      })
      setScenario(isSimulation ? result.run : null)
      if (!isSimulation) await mutate()
    })
  }

  return <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-white">แผนเติมเงินของที่ปรึกษา</h2>
      {edit && <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={editPolicy}>ตั้งค่ากฎพอร์ต</button>
        {policy && <button type="button" className={buttonClass} disabled={busy} onClick={() => calculate(false)}>คำนวณและบันทึกแผน</button>}
      </div>}
    </div>
    {!policy && <p className="text-sm text-slate-300">ยืนยันบัญชี แผน เป้าหมาย และกฎพอร์ตในหน้ากลยุทธ์ก่อนคำนวณ</p>}
    {draft && edit && <form className="space-y-3" onSubmit={submitPolicy}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>บัญชีซื้อขายในสกุลฐาน<select required className={inputClass} value={draft.accountId} onChange={(event) => change({ accountId: event.target.value })}>
          <option value="">เลือกบัญชี</option>
          {data.accounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}
        </select></label>
        <label>แผนลงทุน<select required className={inputClass} value={draft.presetId} onChange={(event) => {
          const selected = data.presets.find((preset) => preset.id === event.target.value)
          change({ presetId: event.target.value, monthlyBudget: Number(selected?.monthlyContribution ?? 0) })
        }}>
          <option value="">เลือกแผน</option>
          {data.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.presetName}</option>)}
        </select></label>
        {([
          ['reserve', 'เงินสดขั้นต่ำ'], ['monthlyBudget', 'เพดานเงินเติมรายเดือน'],
          ['maxPositionPercent', 'เพดานต่อสินทรัพย์ (%)'], ['horizonYears', 'ระยะลงทุน (ปี)'],
          ['feePercent', 'ค่าธรรมเนียมตามมูลค่า (%)'], ['feePerOrder', 'ค่าธรรมเนียมคงที่ต่อรายการ'],
        ] as const).map(([field, label]) => <label key={field}>{label}
          <input className={inputClass} required type="number" min={0} step={field === 'horizonYears' ? 1 : 0.01}
            value={draft[field]} onChange={(event) => change({ [field]: Number(event.target.value) })} />
        </label>)}
      </div>
      <p className="text-xs text-slate-300">ระบุค่าธรรมเนียมและจำนวนหน่วยขั้นต่ำตามบัญชีของคุณ เป้าหมายคิดจากมูลค่าพอร์ตรวมเงินสด</p>
      {draft.targets.map((target, index) => <div key={index} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
        <label>สินทรัพย์<select required className={inputClass} value={target.assetId} onChange={(event) => {
          const asset = data.assets.find((item) => item.id === event.target.value)
          change({ targets: draft.targets.map((row, i) => i === index ? { ...row, assetId: event.target.value, lotSize: asset?.market === 'TH' ? 100 : 1 } : row) })
        }}>
          <option value="">เลือกสินทรัพย์</option>
          {data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.ticker} ({asset.market})</option>)}
        </select></label>
        <label>เป้าหมาย (%)<input className={inputClass} type="number" min="0.01" max="100" step="0.01" required
          value={target.weight} onChange={(event) => change({ targets: draft.targets.map((row, i) => i === index ? { ...row, weight: Number(event.target.value) } : row) })} /></label>
        <label>หน่วยต่อชุด<input className={inputClass} type="number" min="1" required
          value={target.lotSize} onChange={(event) => change({ targets: draft.targets.map((row, i) => i === index ? { ...row, lotSize: Number(event.target.value) } : row) })} /></label>
        <button type="button" className="text-sm text-rose-300" onClick={() => change({ targets: draft.targets.filter((_, i) => i !== index) })}>นำออก</button>
      </div>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => change({ targets: [...draft.targets, { assetId: '', weight: 0, lotSize: 1 }] })}>เพิ่มเป้าหมาย</button>
        <button type="submit" className={buttonClass} disabled={busy || draft.targets.length === 0}>ยืนยันกฎและบันทึก</button>
        <button type="button" className="text-sm text-slate-300" onClick={() => setDraft(null)}>ยกเลิก</button>
      </div>
    </form>}
    {simulate && policy && <div className="grid items-end gap-2 sm:grid-cols-3">
      <label>เงินใหม่ในการจำลอง<input type="number" min="0" step="0.01" className={inputClass} value={inflow} onChange={(event) => setInflow(event.target.value)} /></label>
      <label>เงินสดขั้นต่ำของกรณีจำลอง<input type="number" min="0" step="0.01" className={inputClass} value={reserve} onChange={(event) => setReserve(event.target.value)} placeholder={String(policy.config.reserve)} /></label>
      <button type="button" className={buttonClass} disabled={busy} onClick={() => calculate(true)}>จำลอง</button>
    </div>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {run && <div className="space-y-2 text-sm text-slate-200">
      <p>{scenario ? 'ผลจำลอง' : 'แผนที่บันทึก'} · กฎรุ่น {run.policyVersion} · ข้อมูล ณ {date(run.result.asOf)}</p>
      <p>
        {run.result.status === 'fund' ? 'เติมตามวงเงินที่คำนวณ' : run.result.status === 'wait' ? 'รอจนกว่าวงเงินและเงื่อนไขซื้อจะผ่าน' : 'ตรวจข้อมูลก่อนคำนวณคำแนะนำ'}
        {' · '}ใช้ {amount(run.result.spent)} {run.result.currency} รวมค่าธรรมเนียม {amount(run.result.fees)}
      </p>
      {run.stale && <p role="status" className="text-amber-200">แผนนี้ต้องคำนวณใหม่ก่อนใช้อ้างอิง เพราะพอร์ตเปลี่ยนหรือข้อมูลเลยเวลาใช้งาน</p>}
      <p>{run.result.reason} · งบเดือนนี้ที่เหลือ {amount(run.result.monthlyBudgetLeft)} {run.result.currency}</p>
      <p>เงินสดก่อนเติม {amount(run.result.cashBefore)} · คงเงินไว้หลังเติม {amount(run.result.cashIfHoldAfterDeposit)} · หลังทำตามแผน {amount(run.result.cashAfter)} {run.result.currency}</p>
      {run.result.limitations.map((item) => <p key={item} className="text-amber-200">{item}</p>)}
      {!run.stale && run.result.orders.map((order) => <p key={order.assetId}>
        <strong>{order.ticker}</strong> ({order.market}) {order.quantity} หน่วย · มูลค่า {amount(order.amount)} · สัดส่วน {amount(order.weightBefore)}% → {amount(order.weightAfter)}% · เป้า {order.targetWeight}% · {order.source} ณ {date(order.observedAt)}
      </p>)}
      {scenario?.comparison && <p>เทียบกับแผนตามโปรไฟล์บนข้อมูลชุดเดียวกัน · ยอดใช้ต่าง {amount(scenario.comparison.spent)} · เงินสดหลังทำต่าง {amount(scenario.comparison.cashAfter)} {run.result.currency}</p>}
      {scenario && <button type="button" className="text-indigo-300" onClick={() => setScenario(null)}>กลับไปดูแผนที่บันทึก</button>}
    </div>}
    {edit && policy && <button type="button" disabled={busy} className="text-sm text-indigo-300" onClick={() => void work(async () => {
      const response = await request<{ review: Review }>(endpoint + '?review=1')
      setReview(response.review)
    })}>ดูผลย้อนหลังและเปรียบเทียบระบบเดิม</button>}
    {review && <div className="space-y-1 text-xs text-slate-300">
      <p>รายการที่ติดตาม {review.sampleSize} · วัดการเปลี่ยนแปลงราคาหลังวันแนะนำ</p>
      {review.runs.filter((item) => item.baselineAllocated !== null).slice(0, 5).map((item) =>
        <p key={item.id}>วงเงินระบบเดิม {amount(item.baselineAllocated!)} · ระบบใหม่ใช้ {amount(item.spent)} · ประมวลผล {item.durationMs} ms</p>)}
      {review.observations.map((item) => <p key={item.runId + item.ticker}>
        {item.ticker} · {item.horizons.map((horizon) => `${horizon.sessionsLater} วันทำการ ${horizon.returnPercent === null ? 'รอข้อมูล' : amount(horizon.returnPercent) + '%'}`).join(' · ')}
      </p>)}
    </div>}
  </section>
}

export function AdvisorStockImpact({ symbol, market }: { symbol: string; market: string }) {
  const { data } = useSWR<{ target?: AdvisorPlanResult['targets'][number]; asOf?: string; stale?: boolean }>(
    endpoint + '?' + new URLSearchParams({ symbol, market }), request,
  )
  if (!data?.target || !data.asOf || data.stale) return null
  const { target } = data
  return <p className="my-2 rounded-lg border border-indigo-500/30 p-2 text-xs text-slate-200">
    จากแผนพอร์ต ณ {date(data.asOf)} · สัดส่วน {target.weightBefore.toFixed(2)}% → {target.weightAfter.toFixed(2)}% · เป้า {target.targetWeight}%
  </p>
}
