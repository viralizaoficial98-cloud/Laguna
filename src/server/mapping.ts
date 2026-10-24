/**
 * Conversão entre as entidades do domínio (src/types) e as linhas MySQL (Prisma).
 * - money → DECIMAL (string exacta na escrita; número na leitura)
 * - date → DATE ("AAAA-MM-DD")
 * - datetime → DATETIME(3) UTC (valores sem fuso horário são interpretados na hora de Luanda)
 * - json → LONGTEXT com JSON
 */
import type { CollectionName, DemoData } from "@/domain/engine";
import type { CondoSettings } from "@/types";

type Kind = "str" | "int" | "bool" | "money" | "date" | "datetime" | "json";
type Spec = { delegate: string; fields: Record<string, Kind> };

const s = (names: string) => Object.fromEntries(names.split(/\s+/).filter(Boolean).map((n) => [n, "str" as Kind]));

export const SPECS: Record<CollectionName, Spec> = {
  apartments: { delegate: "apartment", fields: { ...s("id block number status ownerName residentId notes typology"), floor: "int", active: "bool", provisional: "bool" } },
  residents: { delegate: "resident", fields: { ...s("id name email phone documentId apartmentId type status notes"), since: "date", dependents: "json" } },
  occupancies: { delegate: "occupancy", fields: { ...s("id apartmentId residentId residentName"), from: "date", to: "date" } },
  quotas: {
    delegate: "quota",
    fields: { ...s("id apartmentId period description typology status paymentId"), year: "int", quarter: "int", amount: "money", paidAmount: "money", dueDate: "date" },
  },
  payments: {
    delegate: "payment",
    fields: {
      ...s("id quotaId apartmentId residentId method reference status reviewedBy reviewedByRole note registeredBy receiptNumber"),
      amount: "money",
      validatedAmount: "money",
      paidAt: "datetime",
      submittedAt: "datetime",
      reviewedAt: "datetime",
      proof: "json",
    },
  },
  charges: { delegate: "charge", fields: { ...s("id apartmentId description justification status proposedBy confirmedBy moveOutId"), amount: "money", date: "date" } },
  expenses: { delegate: "expense", fields: { ...s("id period category description"), date: "date", amount: "money" } },
  halls: { delegate: "hall", fields: { ...s("id name description"), capacity: "int", active: "bool", demo: "bool" } },
  reservations: {
    delegate: "reservation",
    fields: {
      ...s("id hallId residentId apartmentId startTime endTime eventType eventName notes status"),
      date: "date",
      expectedGuests: "int",
      guests: "json",
      fee: "money",
      createdAt: "datetime",
      expiresAt: "datetime",
      payment: "json",
      history: "json",
    },
  },
  moveOuts: {
    delegate: "moveOut",
    fields: {
      ...s("id reference residentId residentName apartmentId block number typology reason contact notes status"),
      plannedDate: "date",
      createdAt: "datetime",
      completedAt: "datetime",
      financial: "json",
      operational: "json",
      authorization: "json",
      history: "json",
    },
  },
  circulars: {
    delegate: "circular",
    fields: { ...s("id number subject body closing status author authorTitle"), sequence: "int", year: "int", date: "date", recipients: "json", publishedAt: "datetime", updatedAt: "datetime" },
  },
  notices: {
    delegate: "notice",
    fields: { ...s("id title body category visibility status author"), date: "date", pinned: "bool", pdf: "json", publishedAt: "datetime", withdrawnAt: "datetime", updatedAt: "datetime" },
  },
  documents: { delegate: "condoDocument", fields: { ...s("id title description category fileType visibility uploadedBy"), size: "int", updatedAt: "date", file: "json" } },
  notifications: { delegate: "notification", fields: { ...s("id title body href residentId"), at: "datetime", read: "bool", roles: "json", readBy: "json" } },
  visits: { delegate: "visit", fields: { ...s("id kind residentId apartmentId time notes eventName eventType status"), date: "date", guests: "json", createdAt: "datetime", updatedAt: "datetime" } },
  visitChecks: { delegate: "visitCheck", fields: { ...s("id visitId guestId type by"), at: "datetime" } },
  accessLogs: { delegate: "accessLog", fields: { ...s("id type person category apartmentId gate"), at: "datetime" } },
  occurrences: {
    delegate: "occurrence",
    fields: {
      ...s("id title description category priority status block apartmentId location assignee elevatorId residentId resolution reportedBy"),
      photos: "json",
      createdAt: "datetime",
      resolvedAt: "datetime",
      history: "json",
    },
  },
  elevators: { delegate: "elevator", fields: { ...s("id block code status provider notes"), lastMaintenance: "date", nextMaintenance: "date", demo: "bool", history: "json" } },
  opsTasks: {
    delegate: "opsTask",
    fields: {
      ...s("id area type title location block responsible frequency status equipment notes"),
      scheduledDate: "date",
      dueDate: "date",
      executedDate: "date",
      estimatedCost: "money",
      actualCost: "money",
      inspection: "json",
    },
  },
  audit: { delegate: "auditEntry", fields: { ...s("id by role action entity entityId details"), at: "datetime" } },
};

/** Ordem de escrita respeitando as chaves estrangeiras (as eliminações seguem a ordem inversa). */
export const WRITE_ORDER: CollectionName[] = [
  "halls",
  "apartments",
  "residents",
  "occupancies",
  "quotas",
  "payments",
  "charges",
  "expenses",
  "reservations",
  "moveOuts",
  "visits",
  "visitChecks",
  "accessLogs",
  "circulars",
  "notices",
  "documents",
  "notifications",
  "occurrences",
  "elevators",
  "opsTasks",
  "audit",
];

/** Desvio de fuso horário aplicado a instantes sem fuso (Angola: UTC+01:00, sem hora de Verão). */
const LOCAL_OFFSET = process.env.APP_TZ_OFFSET ?? "+01:00";

export class MappingError extends Error {}

function toDate(v: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    // aceita instantes ISO num campo de data (usa a parte da data)
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) v = v.slice(0, 10);
    else throw new MappingError(`Data inválida em ${field}: ${v}`);
  }
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new MappingError(`Data inválida em ${field}: ${v}`);
  return d;
}

function toDateTime(v: string, field: string) {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(v);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00${LOCAL_OFFSET}` : hasZone ? v : `${v}${LOCAL_OFFSET}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new MappingError(`Data/hora inválida em ${field}: ${v}`);
  return d;
}

function toMoney(v: unknown, field: string) {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (typeof n !== "number" || !Number.isFinite(n)) throw new MappingError(`Montante inválido em ${field}`);
  // arredonda ao cêntimo e envia como texto exacto para o DECIMAL
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function toRow(collection: CollectionName, entity: Record<string, unknown>) {
  const spec = SPECS[collection];
  const row: Record<string, unknown> = {};
  for (const [field, kind] of Object.entries(spec.fields)) {
    const v = entity[field];
    if (v === undefined || v === null || (v === "" && (kind === "date" || kind === "datetime"))) {
      row[field] = null;
      continue;
    }
    const name = `${collection}.${field}`;
    switch (kind) {
      case "str":
        row[field] = String(v);
        break;
      case "int":
        row[field] = Math.trunc(Number(v));
        break;
      case "bool":
        row[field] = Boolean(v);
        break;
      case "money":
        row[field] = toMoney(v, name);
        break;
      case "date":
        row[field] = toDate(String(v), name);
        break;
      case "datetime":
        row[field] = toDateTime(String(v), name);
        break;
      case "json":
        row[field] = JSON.stringify(v);
        break;
    }
  }
  return row;
}

export function fromRow(collection: CollectionName, row: Record<string, unknown>) {
  const spec = SPECS[collection];
  const out: Record<string, unknown> = {};
  for (const [field, kind] of Object.entries(spec.fields)) {
    const v = row[field];
    if (v === null || v === undefined) continue;
    switch (kind) {
      case "money":
        out[field] = Number(String(v));
        break;
      case "date":
        out[field] = (v as Date).toISOString().slice(0, 10);
        break;
      case "datetime":
        out[field] = (v as Date).toISOString();
        break;
      case "json":
        out[field] = JSON.parse(String(v));
        break;
      default:
        out[field] = v;
    }
  }
  return out;
}

/** Campos presentes na entidade mas não previstos no esquema (seriam perdidos). */
export function unknownFields(collection: CollectionName, entity: Record<string, unknown>) {
  const spec = SPECS[collection].fields;
  return Object.keys(entity).filter((k) => !(k in spec) && entity[k] !== undefined);
}

export function settingsToRow(st: CondoSettings) {
  return {
    quotaT2: toMoney(st.quotaByTypology.T2, "settings.quotaT2"),
    quotaDuplex: toMoney(st.quotaByTypology.Duplex, "settings.quotaDuplex"),
    dueDay: st.dueDay,
    allowPartial: st.allowPartial,
    reservationFee: toMoney(st.reservationFee, "settings.reservationFee"),
    reservationHoldHours: st.reservationHoldHours,
  };
}

export function settingsFromRow(r: { quotaT2: unknown; quotaDuplex: unknown; dueDay: number; allowPartial: boolean; reservationFee: unknown; reservationHoldHours: number }): CondoSettings {
  return {
    quotaByTypology: { T2: Number(String(r.quotaT2)), Duplex: Number(String(r.quotaDuplex)) },
    dueDay: r.dueDay,
    allowPartial: r.allowPartial,
    reservationFee: Number(String(r.reservationFee)),
    reservationHoldHours: r.reservationHoldHours,
  };
}

export type { DemoData };
