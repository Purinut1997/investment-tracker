export const FOREIGN_INCOME_TAX_SOURCE = 'https://www.rd.go.th/fileadmin/download/news/question_p161_162.pdf'

export const FOREIGN_INCOME_TAX_RULE =
  'ตาม ป.161 และ ป.162 ให้พิจารณาปีที่เกิดเงินได้พึงประเมินจากต่างประเทศ สถานะผู้อยู่ในไทยในปีที่เกิดเงินได้ และปีที่นำเงินได้นั้นเข้าไทย ' +
  'สำหรับหลักเกณฑ์ตั้งแต่ 1 ม.ค. 2567 ให้พิจารณาเงินได้ที่เกิดตั้งแต่วันดังกล่าวในปีที่อยู่ไทยรวมตั้งแต่ 180 วัน เมื่อมีการนำเงินได้นั้นเข้าไทยจึงพิจารณาในปีที่นำเข้า'

export function foreignIncomeAssessment(repatriated: boolean) {
  if (repatriated) {
    return {
      status: 'review_required',
      label: 'นำเงินกลับไทย · ตรวจเงื่อนไข',
      detail: 'ตรวจปีที่เกิดเงินได้ ปีที่นำเข้า จำนวนและประเภทเงินได้ที่นำเข้า และสถานะผู้อยู่ในไทยก่อนประเมินภาษี',
    } as const
  }
  return {
    status: 'not_remitted',
    label: 'ยังไม่นำรายได้นี้เข้าไทย',
    detail: 'ตามสถานะที่ระบุยังไม่มีการนำรายได้นี้เข้าไทยในปีที่เลือก ให้ตรวจเงื่อนไขอีกครั้งหากนำเข้าภายหลัง',
  } as const
}

export function taxReportContextTag(year: number, repatriated: boolean) {
  return `[tax-context:v2:${year}:${repatriated ? 'remitted' : 'not-remitted'}]`
}
