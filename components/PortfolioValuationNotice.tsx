import Link from 'next/link'

export function PortfolioValuationNotice({ issues }: { issues?: string[] }) {
  if (!issues?.length) return null
  return <details className="rounded-xl border border-amber-400/25 bg-amber-950/20 px-4 py-2 text-sm text-amber-100">
    <summary className="min-h-9 cursor-pointer py-2 font-medium">ยอดพอร์ตเป็นประมาณการหรือรวมได้บางส่วน</summary>
    <ul className="list-disc space-y-1 pb-2 pl-4">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    <Link className="inline-flex min-h-11 items-center underline" href="/dashboard">ดูแหล่งข้อมูลที่หน้าพอร์ต</Link>
  </details>
}
