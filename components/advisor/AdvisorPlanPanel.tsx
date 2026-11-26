'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR, { useSWRConfig } from 'swr'
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
function presetTargets(preset: Options['presets'][number] | undefined, assets: Options['assets']): AdvisorPolicyConfig['targets'] {
  const allocation = preset?.targetAllocation
  if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)) return []
  return Object.entries(allocation).flatMap(([symbol, weight]) => {
    const matches = assets.filter(asset => asset.ticker.toUpperCase() === symbol.trim().toUpperCase())
    if (matches.length !== 1 || typeof weight !== 'number' || weight <= 0 || weight > 100) return []
    const [asset] = matches
    return [{ assetId: asset.id, weight, lotSize: asset.market === 'TH' ? 100 : 1 }]
  })
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
  const { data, error: loadError, mutate } = useSWR<Options>(edit ? endpoint + '?options=1' : endpoint, request)
  const [draft, setDraft] = useState<AdvisorPolicyConfig | null>(null)
  const { mutate: refresh } = useSWRConfig()
  const [step, setStep] = useState(1)
  const [draftVersion, setDraftVersion] = useState(0)
  const [review, setReview] = useState<Review | null>(null)
  const [scenario, setScenario] = useState<Run | null>(null)
  const [inflow, setInflow] = useState('')
  const [reserve, setReserve] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (loadError && !data) return <p role="alert" className="text-sm text-amber-200">โหลดแผนเติมเงินไม่สำเร็จ <button type="button" onClick={() => void mutate()} className="min-h-11 underline">ลองอีกครั้ง</button></p>
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
    setError('')
    setStep(1)
    setDraftVersion(policy?.version ?? 0)
    setDraft(policy?.config ?? {
      accountId: data.accounts[0]?.id ?? '', presetId: data.presets[0]?.id ?? '',
      reserve: 0, monthlyBudget: Number(data.presets[0]?.monthlyContribution ?? 0),
      maxPositionPercent: 20, horizonYears: 10, feePercent: 0, feePerOrder: 0, targets: presetTargets(data.presets[0], data.assets),
    })
  }

  function submitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || busy) return
    if (step < 3) {
      if (step === 2 && (!draft.targets.length || new Set(draft.targets.map(t => t.assetId)).size !== draft.targets.length || draft.targets.reduce((sum, t) => sum + t.weight, 0) > 100 + 1e-8)) {
        setError('เลือกสินทรัพย์อย่างน้อยหนึ่งตัวโดยไม่ซ้ำ และให้น้ำหนักรวมไม่เกิน 100%')
        return
      }
      setError('')
      setStep(step + 1)
      return
    }
    void work(async () => {
      const saved = await request<{ policy: Policy }>(endpoint, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: draft, expectedVersion: draftVersion }),
      })
      setDraft(null)
      setScenario(null)
      try {
        await request(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedVersion: saved.policy.version }),
        })
      } catch (err) {
        throw new Error('บันทึกกฎแล้ว แต่คำนวณแผนไม่สำเร็จ · ' + (err instanceof Error ? err.message : '') + ' กดคำนวณและบันทึกแผนเพื่อลองอีกครั้ง')
      } finally {
        await Promise.all([mutate(), refresh(endpoint)])
      }
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
      if (!isSimulation) await Promise.all([mutate(), refresh(endpoint)])
    })
  }

  return <section id="advisor-plan" className="scroll-mt-24 space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-white">แผนเติมเงินของที่ปรึกษา</h2>
      {edit && !draft && <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy} onClick={editPolicy}>ตั้งค่ากฎพอร์ต</button>
        {policy && <button type="button" className={buttonClass} disabled={busy} onClick={() => calculate(false)}>คำนวณและบันทึกแผน</button>}
      </div>}
    </div>
    {!policy && <p className="text-sm text-slate-300">เลือกบัญชีและแผนลงทุนก่อนคำนวณเงินเติม { !edit && <Link className="underline" href="/plans#advisor-plan">ไปตั้งค่ากฎพอร์ต</Link> }</p>}
    {draft && edit && <form className="space-y-3" onSubmit={submitPolicy}>
      <p aria-live="polite" className="font-medium text-indigo-200">ขั้น {step} จาก 3 · {step === 1 ? 'เลือกบัญชีและแผน' : step === 2 ? 'ตรวจงบและเป้าหมาย' : 'ตรวจรายละเอียดก่อนยืนยัน'}</p>
      {step === 1 && <div className="grid gap-2 sm:grid-cols-2">
        <label>บัญชีซื้อขายในสกุลฐาน<select required className={inputClass} value={draft.accountId} onChange={(event) => change({ accountId: event.target.value })}>
          <option value="">เลือกบัญชี</option>
          {data.accounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}
        </select></label>
        <label>แผนลงทุน<select required className={inputClass} value={draft.presetId} onChange={(event) => {
          const selected = data.presets.find((preset) => preset.id === event.target.value)
          change({ presetId: event.target.value, monthlyBudget: Number(selected?.monthlyContribution ?? 0), targets: presetTargets(selected, data.assets) })
        }}>
          <option value="">เลือกแผน</option>
          {data.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.presetName}</option>)}
        </select></label>
        {!data.accounts.length && <Link href="/accounts" className="underline">เพิ่มบัญชีซื้อขายสกุล {data.currency}</Link>}
        {!data.presets.length && <a href="#investment-presets" className="underline">สร้างแผนลงทุนด้านล่าง</a>}
      </div>}
      {step === 2 && <>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          ['reserve', 'เงินสดขั้นต่ำ'], ['monthlyBudget', 'เพดานเงินเติมรายเดือน'],
          ['maxPositionPercent', 'เพดานต่อสินทรัพย์ (%)'], ['horizonYears', 'ระยะลงทุน (ปี)'],
          ['feePercent', 'ค่าธรรมเนียมตามมูลค่า (%)'], ['feePerOrder', 'ค่าธรรมเนียมคงที่ต่อรายการ'],
        ] as const).map(([field, label]) => <label key={field}>{label}
          <input className={inputClass} required type="number" min={field === 'horizonYears' ? 1 : field === 'maxPositionPercent' ? 0.01 : 0}
            max={field === 'monthlyBudget' ? Number(data.presets.find(p => p.id === draft.presetId)?.monthlyContribution) : field === 'feePercent' ? 10 : field === 'maxPositionPercent' ? 100 : field === 'horizonYears' ? 50 : 100000000} step={field === 'horizonYears' ? 1 : 0.01}
            value={draft[field]} onChange={(event) => change({ [field]: Number(event.target.value) })} />
        </label>)}
      </div>
      <p className="text-xs text-slate-300">ระบุค่าธรรมเนียมและจำนวนหน่วยขั้นต่ำตามบัญชีของคุณ เป้าหมายคิดจากมูลค่าพอร์ตรวมเงินสด</p>
      {draft.targets.map((target, index) => <div key={index} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
        <label>สินทรัพย์<select aria-label="สินทรัพย์" required className={inputClass} value={target.assetId} onChange={(event) => {
          const asset = data.assets.find((item) => item.id === event.target.value)
          change({ targets: draft.targets.map((row, i) => i === index ? { ...row, assetId: event.target.value, lotSize: asset?.market === 'TH' ? 100 : 1 } : row) })
        }}>
          <option value="">เลือกสินทรัพย์</option>
          {data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.ticker} ({asset.market})</option>)}
        </select></label>
        <label>เป้าหมาย (%)<input className={inputClass} type="number" min="0.01" max="100" step="0.01" required
          value={target.weight} onChange={(event) => change({ targets: draft.targets.map((row, i) => i === index ? { ...row, weight: Number(event.target.value) } : row) })} /></label>
        <label>หน่วยต่อชุด<input className={inputClass} type="number" min="1" max="10000" required
          value={target.lotSize} onChange={(event) => change({ targets: draft.targets.map((row, i) => i === index ? { ...row, lotSize: Number(event.target.value) } : row) })} /></label>
        <button type="button" className="text-sm text-rose-300" onClick={() => change({ targets: draft.targets.filter((_, i) => i !== index) })}>นำออก</button>
      </div>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={draft.targets.length >= 50 || !data.assets.length} onClick={() => change({ targets: [...draft.targets, { assetId: '', weight: 0, lotSize: 1 }] })}>เพิ่มเป้าหมาย</button>
      </div>
      {!data.assets.length && <Link href="/transactions" className="underline">เพิ่มรายการถือครองเพื่อเลือกเป้าหมาย</Link>}
      </>}
      {step === 3 && <div className="space-y-1 rounded-lg bg-slate-800 p-3 text-sm">
        <p>{data.accounts.find(a => a.id === draft.accountId)?.accountName} · {data.presets.find(p => p.id === draft.presetId)?.presetName}</p>
        <p>เงินเติมได้ถึง {amount(draft.monthlyBudget)} {data.currency}/เดือน · กันเงินสด {amount(draft.reserve)} {data.currency}</p>
        <p>เพดานต่อสินทรัพย์ {draft.maxPositionPercent}% · ระยะลงทุน {draft.horizonYears} ปี</p>
        <p>ค่าธรรมเนียม {draft.feePercent}% และ {amount(draft.feePerOrder)} {data.currency} ต่อรายการ</p>
        {draft.targets.map(t => <p key={t.assetId}>{data.assets.find(a => a.id === t.assetId)?.ticker} · เป้า {t.weight}% · ชุดละ {t.lotSize} หน่วย</p>)}
      </div>}
      <div className="flex flex-wrap gap-3">
        {step > 1 && <button type="button" disabled={busy} className="text-sm" onClick={() => { setError(''); setStep(step - 1) }}>ย้อนกลับ</button>}
        <button type="submit" className={buttonClass} disabled={busy}>{busy ? 'กำลังบันทึก…' : step === 3 ? 'ยืนยันและคำนวณแผน' : 'ถัดไป'}</button>
        <button type="button" className="text-sm text-slate-300" disabled={busy} onClick={() => { setError(''); setDraft(null) }}>ยกเลิก</button>
      </div>
    </form>}
    {simulate && policy && <p className="text-sm text-slate-300">
      ถามในแชตได้ เช่น “สรุปแผนเติมเงิน” “ถ้ามีเงินลงทุน 5,000” หรือ “ถ้ากันเงินสดขั้นต่ำ 3,000”
    </p>}
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
