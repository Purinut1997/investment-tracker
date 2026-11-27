import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { adviceCacheKey } from '@/lib/ai/advice-cache-key'
import { withLedgerTransaction } from './transaction-ledger'

export class LedgerRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}

export async function withLedgerRequest<T>(
  userId: string,
  scope: 'transaction' | 'transaction-batch' | 'cash-wallet',
  key: string | null,
  input: unknown,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (key === null) return withLedgerTransaction(write)
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(key)) {
    throw new LedgerRequestError('รหัสคำขอบันทึกไม่ถูกต้อง', 400)
  }
  const fingerprint = adviceCacheKey([scope, input])
  const where = { userId_key: { userId, key } }
  const replay = (receipt: { fingerprint: string; response: Prisma.JsonValue }) => {
    if (receipt.fingerprint !== fingerprint) {
      throw new LedgerRequestError('รหัสคำขอนี้ใช้กับข้อมูลชุดอื่นแล้ว กรุณาตรวจรายการก่อนส่งใหม่', 409)
    }
    return receipt.response as T
  }

  try {
    return await withLedgerTransaction(async tx => {
      const receipt = await tx.transactionRequestReceipt.findUnique({ where })
      if (receipt) return replay(receipt)
      await tx.transactionRequestReceipt.create({ data: { userId, key, fingerprint, response: Prisma.JsonNull } })
      const result = await write(tx)
      await tx.transactionRequestReceipt.update({
        where,
        data: { response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue },
      })
      return result
    })
  } catch (error) {
    // A competing request may have committed the receipt while this transaction waited.
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      const receipt = await prisma.transactionRequestReceipt.findUnique({ where })
      if (receipt) return replay(receipt)
    }
    throw error
  }
}
