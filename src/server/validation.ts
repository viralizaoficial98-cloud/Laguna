/**
 * Validação dos argumentos das acções recebidas pelo servidor (antes das regras de negócio).
 * As regras de negócio e as permissões são depois aplicadas pelo motor de domínio.
 */
import { z } from "zod";
import { ActionError } from "./errors";

const id = z.string().min(1).max(120);
const text = (max = 2000) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD).");
const money = z.number().finite().positive().max(1_000_000_000);
const file = z.object({ name: text(255), type: text(100), size: z.number().int().nonnegative().max(10 * 1024 * 1024), fileId: id.optional() }).passthrough();
const method = z.enum(["transferencia", "multicaixa", "deposito", "numerario"]);
const guests = z.array(z.object({ id, name: text(160).min(1), phone: text(40).optional() })).max(500);

const SCHEMAS: Partial<Record<string, z.ZodType>> = {
  submitPayment: z.tuple([
    z.object({ quotaId: id, apartmentId: id, residentId: id.optional(), amount: money, method, reference: text(120), paidAt: z.string().max(40), proof: file.optional(), note: text().optional() }).passthrough(),
  ]),
  reviewPayment: z.union([
    z.tuple([id, z.enum(["aprovado", "rejeitado"])]),
    z.tuple([id, z.enum(["aprovado", "rejeitado"]), z.object({ note: text().optional(), validatedAmount: money.optional() })]),
  ]),
  registerPayment: z.tuple([z.object({ quotaId: id, amount: money, method, reference: text(120), paidAt: isoDate, note: text().optional() })]),
  addExpense: z.tuple([z.object({ date: isoDate, category: text(40), description: text(255).min(1), amount: money })]),
  requestReservation: z.union([
    z.tuple([z.object({ hallId: id, date: isoDate, startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), eventType: text(60), eventName: text(160).min(1), expectedGuests: z.number().int().min(0).max(2000), guests, notes: text().optional() })]),
    z.tuple([
      z.object({ hallId: id, date: isoDate, startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), eventType: text(60), eventName: text(160).min(1), expectedGuests: z.number().int().min(0).max(2000), guests, notes: text().optional() }),
      z.object({ waitlist: z.boolean().optional() }),
    ]),
  ]),
  submitReservationPayment: z.tuple([id, z.object({ reference: text(120), proof: file.optional() })]),
  reviewReservationPayment: z.union([z.tuple([id, z.enum(["aprovado", "rejeitado"])]), z.tuple([id, z.enum(["aprovado", "rejeitado"]), text().optional()])]),
  cancelReservation: z.union([z.tuple([id]), z.tuple([id, text(500).optional()])]),
  updateReservationGuests: z.tuple([id, guests]),
  requestMoveOut: z.tuple([z.object({ plannedDate: isoDate, reason: text(500).optional(), contact: text(120).min(1), notes: text().optional() })]),
  proposeCharge: z.tuple([z.object({ apartmentId: id, description: text(255).min(1), justification: text().min(1), amount: money, moveOutId: id.optional() })]),
  decideCharge: z.tuple([id, z.enum(["confirmado", "anulado", "pago"])]),
  runFinancialCheck: z.union([z.tuple([id]), z.tuple([id, text().optional()])]),
  authorizeMoveOut: z.union([z.tuple([id]), z.tuple([id, text().optional()])]),
  completeMoveOut: z.tuple([id]),
  cancelMoveOut: z.union([z.tuple([id]), z.tuple([id, text(500).optional()])]),
  emitQuotas: z.tuple([z.string().regex(/^\d{4}-T[1-4]$/)]),
  markNotificationsRead: z.tuple([z.array(id).max(500)]),
  updateSettings: z.tuple([
    z
      .object({
        quotaByTypology: z.object({ T2: money, Duplex: money }).strict().optional(),
        dueDay: z.number().int().min(1).max(28).optional(),
        allowPartial: z.boolean().optional(),
        reservationFee: z.number().finite().min(0).max(100_000_000).optional(),
        reservationHoldHours: z.number().int().min(1).max(720).optional(),
      })
      .strict(),
  ]),
};

const MAX_BYTES = 256 * 1024;

export function validateActionArgs(name: string, args: unknown[]) {
  const size = JSON.stringify(args).length;
  if (size > MAX_BYTES) throw new ActionError("Pedido demasiado grande. Envie os anexos como ficheiros.", 413);
  if (args.length > 4) throw new ActionError("Argumentos inválidos.", 400);
  const schema = SCHEMAS[name];
  if (!schema) return;
  const r = schema.safeParse(args);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new ActionError(`Dados inválidos${issue?.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue?.message ?? "formato incorrecto"}.`, 400);
  }
}
