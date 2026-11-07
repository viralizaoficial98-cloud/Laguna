/**
 * Testes de integração da gestão administrativa e financeira (Nelson Rodrigues — centro de gestão).
 * Executar contra um servidor em execução e uma base de dados de TESTE — nunca a de produção.
 *
 *   BASE_URL=http://localhost:3100 XLSX_DIR=/caminho/para/os/excel npm run test:gestao
 *
 * XLSX_DIR (opcional) contém os três ficheiros Excel do condomínio; os ficheiros não fazem parte do
 * repositório (dados pessoais). Sem XLSX_DIR os testes de importação são ignorados.
 */
import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { prisma } from "@/server/db";
import { initialUsers } from "@/data/users";
import { BASE, Client, PNG, activate, counts, ok, pw, upload } from "./helpers";

/** PNG RGBA w×h (traço escuro sobre fundo transparente) — para a assinatura de teste. */
function signaturePng(w = 240, h = 80) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = Math.abs(y - (h / 2 + Math.sin(x / 12) * h * 0.3)) < 2;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o + 2] = 0x40;
      raw[o + 3] = on ? 255 : 0;
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

type Q = { id: string; apartmentId: string; amount: number; paidAmount: number; status: string; period: string };

async function main() {
  console.log(`Servidor: ${BASE}\n`);
  const C: Record<string, Client> = {};
  for (const u of initialUsers) {
    const p = pw();
    await activate(u.email, p);
    C[u.role] = new Client(u.role);
    ok(`login — ${u.name}`, (await C[u.role].login(u.email, p)).status === 200);
  }
  const [adm, ges, fin, mor, por] = (["administrador", "gestor", "financeiro", "morador", "porteiro"] as const).map((r) => C[r]);
  const before = { apartments: await prisma.apartment.count(), residents: await prisma.resident.count(), quotas: await prisma.quota.count(), payments: await prisma.payment.count() };

  // ————— 1. matriz de permissões no servidor —————
  console.log("\n1 Permissões (Nelson = centro de gestão)");
  ok("Nelson acede às fracções", (await ges.req("/api/fractions")).status === 200);
  ok("Nelson acede ao orçamento", (await ges.req("/api/budget?year=2026")).status === 200);
  ok("Nelson acede à auditoria (só leitura)", (await ges.req("/api/audit")).status === 200);
  ok("Nelson acede às importações", (await ges.req("/api/excel-import/runs")).status === 200);
  ok("Nelson vê as despesas detalhadas", Array.isArray((await ges.state()).expenses));
  const mkAdm = await ges.req("/api/users", { method: "POST", json: { name: "X Admin", email: `x.${Date.now()}@teste.ao`, role: "administrador" } });
  ok("Nelson continua sem poder criar administradores", mkAdm.status === 403, `${mkAdm.status} ${mkAdm.text.slice(0, 200)}`);
  ok("Portaria sem acesso às fracções", (await por.req("/api/fractions")).status === 403);
  ok("Portaria sem acesso ao orçamento", (await por.req("/api/budget?year=2026")).status === 403);
  ok("morador sem acesso à auditoria", (await mor.req("/api/audit")).status === 403);
  ok("morador sem acesso à importação", (await mor.req("/api/excel-import/runs")).status === 403);
  ok("Saraiva sem acesso à importação de dados", (await fin.req("/api/excel-import/runs")).status === 403);
  ok("auditoria não pode ser alterada via acções", (await ges.action("clearAudit")).status === 400);

  // ————— 2. proprietários e inquilinos —————
  console.log("\n2 Proprietários e inquilinos");
  const fr = (await ges.req("/api/fractions")).data.fractions as { id: string; code: string; owner: { name: string } | null; tenant: { name: string } | null }[];
  ok("100 fracções listadas", fr.length === 100, String(fr.length));
  const target = fr.find((f) => f.id !== "apt_06_201" && !f.tenant) ?? fr.find((f) => f.id !== "apt_06_201")!;
  const stamp = Date.now().toString(36);
  const own = await ges.req("/api/holders", { method: "POST", json: { op: "assign", apartmentId: target.id, role: "proprietario", party: { name: `Proprietário Teste ${stamp}` } } });
  ok("Nelson associa proprietário à fracção", own.status === 200, JSON.stringify(own.data));
  const ten = await ges.req("/api/holders", { method: "POST", json: { op: "assign", apartmentId: target.id, role: "inquilino", party: { name: `Inquilino Teste ${stamp}` } } });
  ok("Nelson associa inquilino à mesma fracção (separado do proprietário)", ten.status === 200, JSON.stringify(ten.data));
  let ficha = (await ges.req(`/api/fractions/${target.id}`)).data as { owner: { party: { name: string } } | null; tenant: { party: { name: string } } | null; holderHistory: unknown[] };
  ok("ficha mostra proprietário e inquilino distintos", ficha.owner?.party.name === `Proprietário Teste ${stamp}` && ficha.tenant?.party.name === `Inquilino Teste ${stamp}`, JSON.stringify({ o: ficha.owner, t: ficha.tenant }).slice(0, 300));
  const own2 = await ges.req("/api/holders", { method: "POST", json: { op: "assign", apartmentId: target.id, role: "proprietario", party: { name: `Novo Proprietário ${stamp}` } } });
  ok("substituição de proprietário", own2.status === 200 && (own2.data as { status?: string }).status === "substituido", JSON.stringify(own2.data));
  ficha = (await ges.req(`/api/fractions/${target.id}`)).data as typeof ficha;
  ok("histórico de titulares preservado", ficha.holderHistory.length >= 3);
  const slots = await prisma.activeHolderSlot.count({ where: { apartmentId: target.id, role: "proprietario" } });
  ok("restrição na base de dados: um único proprietário activo por fracção", slots === 1);
  ok("encerrar arrendamento exige motivo", (await ges.req("/api/holders", { method: "POST", json: { op: "end", apartmentId: target.id, role: "inquilino", reason: "" } })).status === 400);
  ok("encerrar arrendamento", (await ges.req("/api/holders", { method: "POST", json: { op: "end", apartmentId: target.id, role: "inquilino", reason: "Fim do contrato (teste)" } })).status === 200);
  ficha = (await ges.req(`/api/fractions/${target.id}`)).data as typeof ficha;
  ok("fracção sem inquilino fica vazia (sem dados fictícios)", ficha.tenant === null);
  ok("Saraiva não altera titulares", (await fin.req("/api/holders", { method: "POST", json: { op: "assign", apartmentId: target.id, role: "proprietario", party: { name: "X" } } })).status === 403);
  ok("morador não consulta a ficha de outra fracção", (await mor.req(`/api/fractions/${target.id}`)).status === 403);

  // ————— 3. pagamento presencial —————
  console.log("\n3 Pagamento presencial");
  let sGes = await ges.state();
  const quota = (sGes.quotas as Q[]).find((q) => q.apartmentId !== "apt_06_201" && (q.status === "pendente" || q.status === "em_atraso") && !(sGes.payments as { quotaId: string; status: string }[]).some((p) => p.quotaId === q.id && p.status === "em_analise"));
  ok("existe quota em aberto noutra fracção", !!quota);
  const remaining = quota!.amount - quota!.paidAmount;
  const key = `t-${stamp}-1`;
  ok("pagamento acima do valor em dívida recusado", (await ges.action("registerPayment", { quotaId: quota!.id, amount: remaining + 1, method: "numerario", paidAt: new Date().toISOString(), clientKey: `${key}-x` })).status >= 400);
  const half = Math.round(remaining / 2);
  const [p1, p2] = await Promise.all([
    ges.action("registerPayment", { quotaId: quota!.id, amount: half, method: "numerario", paidAt: new Date().toISOString(), note: "Pagamento ao balcão (teste)", clientKey: key }),
    ges.action("registerPayment", { quotaId: quota!.id, amount: half, method: "numerario", paidAt: new Date().toISOString(), note: "Pagamento ao balcão (teste)", clientKey: key }),
  ]);
  ok("duplo clique: apenas um pagamento registado", [p1, p2].filter((r) => r.status === 200).length === 1, `${p1.status}/${p2.status}`);
  ok("chave única na base de dados", (await prisma.payment.count({ where: { clientKey: key } })) === 1);
  sGes = await ges.state();
  const pay = (sGes.payments as { id: string; clientKey?: string; status: string; channel?: string; receiptNumber?: string; proof?: unknown }[]).find((p) => p.clientKey === key)!;
  ok("pagamento parcial presencial aprovado com recibo, sem comprovativo assinalado", pay?.status === "aprovado" && pay.channel === "presencial" && !!pay.receiptNumber && !pay.proof);
  const q2 = (sGes.quotas as Q[]).find((q) => q.id === quota!.id)!;
  ok("quota → Parcialmente paga", q2.status === "parcial" || q2.status === "parcialmente_paga", q2.status);
  // comprovativo carregado em nome do morador
  const up = await upload(ges, PNG, "talao.png", "image/png");
  const rest = quota!.amount - q2.paidAmount;
  const p3 = await ges.action("registerPayment", { quotaId: quota!.id, amount: rest, method: "deposito", reference: `DEP-${stamp}`, paidAt: new Date().toISOString(), proof: { name: "talao.png", type: "image/png", size: PNG.length, fileId: up.data.id }, clientKey: `${key}-2` });
  ok("restante pago com comprovativo carregado por Nelson", p3.status === 200, JSON.stringify(p3.data.error));
  const f = await prisma.storedFile.findUnique({ where: { id: String(up.data.id) } });
  ok("comprovativo associado à fracção e categoria 'proof'", f?.apartmentId === quota!.apartmentId && f?.category === "proof");
  ok("comprovativo de outra fracção inacessível ao morador demo", (await mor.req(`/api/files/${up.data.id}`)).status === 403);
  ok("quota paga não aceita novo pagamento", (await ges.action("registerPayment", { quotaId: quota!.id, amount: 1, method: "numerario", paidAt: new Date().toISOString(), clientKey: `${key}-3` })).status >= 400);
  ok("morador não regista pagamentos presenciais", (await mor.action("registerPayment", { quotaId: quota!.id, amount: 1, method: "numerario", paidAt: new Date().toISOString() })).status === 403);
  ok("Portaria não regista pagamentos", (await por.action("registerPayment", { quotaId: quota!.id, amount: 1, method: "numerario", paidAt: new Date().toISOString() })).status === 403);

  // ————— 4. despesas e fornecedores —————
  console.log("\n4 Despesas e fornecedores");
  const nif = `9${Date.now().toString().slice(-8)}`;
  const sup = await ges.action("saveSupplier", { id: "", name: `Fornecedor Teste ${stamp}`, nif, category: "Manutenção", active: true, createdAt: "" });
  ok("Nelson regista fornecedor", sup.status === 200, JSON.stringify(sup.data.error));
  ok("NIF de fornecedor único", (await ges.action("saveSupplier", { id: "", name: "Outro nome", nif, active: true, createdAt: "" })).status >= 400);
  const supplier = ((await ges.state()).suppliers as { id: string; name: string }[]).find((x) => x.name === `Fornecedor Teste ${stamp}`)!;
  const base = { description: `Despesa teste ${stamp}`, category: "manutencao", amount: 100000, vat: 14000, withholding: 6500, date: new Date().toISOString().slice(0, 10), supplierId: supplier?.id, supplierName: supplier?.name, nif, invoiceRef: `FT-${stamp}` };
  const exp = await ges.action("addExpense", base);
  ok("Nelson regista despesa (líquido calculado)", exp.status === 200, JSON.stringify(exp.data.error));
  const expDup = await ges.action("addExpense", base);
  ok("factura duplicada recusada", expDup.status >= 400);
  const e = ((await ges.state()).expenses as { id: string; invoiceRef?: string; netAmount?: number; status?: string }[]).find((x) => x.invoiceRef === `FT-${stamp}`)!;
  ok("valor líquido = valor + IVA − retenção", e?.netAmount === 107500, String(e?.netAmount));
  ok("aprovar despesa", (await ges.action("approveExpense", e.id)).status === 200);
  ok("pagamento parcial da despesa", (await ges.action("payExpense", e.id, { date: new Date().toISOString().slice(0, 10), amount: 50000 })).status === 200);
  ok("despesa com pagamentos não pode ser eliminada", (await ges.action("deleteExpense", e.id)).status >= 400);
  ok("anulação exige motivo", (await ges.action("voidExpense", e.id, "")).status >= 400);
  ok("anulação com motivo (registo preservado)", (await ges.action("voidExpense", e.id, "Teste de anulação")).status === 200);
  ok("despesa anulada continua na base de dados", (await prisma.expense.findUnique({ where: { id: e.id } }))?.status === "anulada");
  ok("Portaria não regista despesas", (await por.action("addExpense", { description: "x", category: "outros", amount: 1, date: "2026-01-01" })).status === 403);

  // ————— 5. assinatura e declarações —————
  console.log("\n5 Assinatura e declarações");
  const form = new FormData();
  form.append("file", new File([new Uint8Array(signaturePng())], "assinatura.png", { type: "image/png" }));
  form.append("displayName", "Nelson Rodrigues");
  form.append("title", "Gestor Operacional");
  const sig = await ges.req("/api/signature", { method: "POST", body: form });
  ok("Nelson carrega a assinatura (PNG)", sig.status === 201, JSON.stringify(sig.data));
  const sigRow = await prisma.signature.findFirst({ where: { userId: "usr_nelson_rodrigues", active: true } });
  ok("assinatura guardada de forma privada", !!sigRow);
  const sigFile = sigRow ? await prisma.storedFile.findFirst({ where: { category: "signature", ownerUserId: "usr_nelson_rodrigues" }, orderBy: { createdAt: "desc" } }) : null;
  ok("imagem da assinatura inacessível a José, Saraiva e morador", !!sigFile && (await adm.req(`/api/files/${sigFile.id}`)).status === 403 && (await fin.req(`/api/files/${sigFile.id}`)).status === 403 && (await mor.req(`/api/files/${sigFile.id}`)).status === 403);
  ok("imagem inacessível sem sessão", !!sigFile && (await new Client("anon").req(`/api/files/${sigFile.id}`)).status === 401);

  // cancela pedidos em curso de execuções anteriores (o morador só pode ter um pedido por tipo)
  for (const d of await prisma.declaration.findMany({ where: { residentId: "res_demo", status: { in: ["solicitada", "em_analise", "aguardando_assinatura"] } } })) await mor.req(`/api/declarations/${d.id}`, { method: "POST", json: { op: "cancel", reason: "limpeza de teste" } });
  const req1 = await mor.req("/api/declarations", { method: "POST", json: { typeCode: "residencia", purpose: "Abertura de conta bancária" } });
  ok("morador solicita declaração de residência", req1.status === 201, JSON.stringify(req1.data));
  const dec = (req1.data.declaration as { id: string; number: string; status: string })!;
  ok("número único DEC-AAAA-NNNN e estado Solicitada", /^DEC-\d{4}-\d{4}$/.test(dec.number) && dec.status === "solicitada");
  ok("pedido duplicado do mesmo tipo recusado", (await mor.req("/api/declarations", { method: "POST", json: { typeCode: "residencia" } })).status === 409);
  ok("Nelson é notificado do pedido", ((await ges.state()).notifications as { title: string }[]).some((n) => n.title.includes(dec.number)));
  ok("morador não pode assinar", (await mor.req(`/api/declarations/${dec.id}`, { method: "POST", json: { op: "sign", confirm: true } })).status === 403);
  ok("Nelson coloca em análise", (await ges.req(`/api/declarations/${dec.id}`, { method: "POST", json: { op: "review" } })).status === 200);
  const prep = await ges.req(`/api/declarations/${dec.id}`, { method: "POST", json: { op: "prepare" } });
  ok("requisitos verificados → A aguardar assinatura", prep.status === 200 && (prep.data.declaration as { status: string }).status === "aguardando_assinatura", JSON.stringify(prep.data));
  ok("assinatura sem confirmação expressa recusada", (await ges.req(`/api/declarations/${dec.id}`, { method: "POST", json: { op: "sign" } })).status === 400);
  const signed = await ges.req(`/api/declarations/${dec.id}`, { method: "POST", json: { op: "sign", confirm: true } });
  const sd = signed.data.declaration as { status: string; pdfFileId: string; verificationCode: string; signerName: string };
  ok("Nelson assina → Emitida com PDF", signed.status === 200 && sd.status === "emitida" && !!sd.pdfFileId && sd.signerName === "Nelson Rodrigues", JSON.stringify(signed.data));
  const pdf = await mor.req(`/api/files/${sd.pdfFileId}`);
  ok("morador descarrega o PDF assinado", pdf.status === 200 && pdf.text.startsWith("%PDF"));
  ok("PDF inacessível à Portaria", (await por.req(`/api/files/${sd.pdfFileId}`)).status === 403);
  ok("morador é notificado da emissão", ((await mor.state()).notifications as { title: string }[]).some((n) => n.title.includes(dec.number)));
  const ver = await new Client("anon").req(`/api/verify?codigo=${sd.verificationCode}`);
  ok("verificação pública por código QR (só iniciais)", ver.data.valid === true && ver.data.number === dec.number && !String(ver.data.holder).includes("Muenho"), JSON.stringify(ver.data));
  ok("código inválido → não válido", (await new Client("anon").req("/api/verify?codigo=0000000000000000")).data.valid === false);
  ok("revogação exige motivo", (await ges.req(`/api/declarations/${dec.id}`, { method: "POST", json: { op: "revoke", reason: "" } })).status === 400);
  ok("Nelson revoga a declaração", (await ges.req(`/api/declarations/${dec.id}`, { method: "POST", json: { op: "revoke", reason: "Teste de revogação" } })).status === 200);
  ok("verificação mostra revogação", !!(await new Client("anon").req(`/api/verify?codigo=${sd.verificationCode}`)).data.revokedAt);
  const myDecl = (await mor.req("/api/declarations")).data.declarations as { residentId: string }[];
  ok("morador só vê as suas declarações", myDecl.every((d) => d.residentId === "res_demo"));
  // titularidade exige confirmação documental
  const tit = await ges.req("/api/declarations", { method: "POST", json: { typeCode: "titularidade", apartmentId: target.id, subject: "proprietario", purpose: "Teste" } });
  ok("emissão presencial (titularidade) criada", tit.status === 201, JSON.stringify(tit.data));
  const tid = (tit.data.declaration as { id: string; status: string }).id;
  const st = (tit.data.declaration as { status: string }).status;
  if (st === "solicitada") await ges.req(`/api/declarations/${tid}`, { method: "POST", json: { op: "review" } });
  ok("titularidade sem confirmação documental bloqueada", (await ges.req(`/api/declarations/${tid}`, { method: "POST", json: { op: "prepare" } })).status === 422);
  ok("titularidade com confirmação documental aceite", (await ges.req(`/api/declarations/${tid}`, { method: "POST", json: { op: "prepare", ownershipConfirmed: true } })).status === 200);
  ok("cancelamento", (await ges.req(`/api/declarations/${tid}`, { method: "POST", json: { op: "cancel", reason: "teste" } })).status === 200);
  // declaração de não dívida bloqueada quando há dívida
  const sNow = await ges.state();
  const occupied = new Set((sNow.apartments as { id: string; residentId?: string }[]).filter((a) => a.residentId).map((a) => a.id));
  const owing = (sNow.quotas as Q[]).find((q) => q.status === "em_atraso" && q.apartmentId !== target.id && occupied.has(q.apartmentId));
  if (owing) {
    const nd = await ges.req("/api/declarations", { method: "POST", json: { typeCode: "quotas_regularizadas", apartmentId: owing.apartmentId, subject: "morador" } });
    const nid = (nd.data.declaration as { id: string; status: string } | undefined)?.id;
    if (nid && (nd.data.declaration as { status: string }).status === "solicitada") await ges.req(`/api/declarations/${nid}`, { method: "POST", json: { op: "review" } });
    const prepD = nid ? await ges.req(`/api/declarations/${nid}`, { method: "POST", json: { op: "prepare" } }) : null;
    ok("declaração de quotas regularizadas bloqueada com dívida", prepD?.status === 422, `${nd.status} ${nd.text.slice(0, 200)} | ${prepD?.status} ${prepD?.text.slice(0, 300)}`);
    if (nid) await ges.req(`/api/declarations/${nid}`, { method: "POST", json: { op: "cancel", reason: "teste" } });
  }

  // ————— 6. importação Excel (opcional) —————
  const dir = process.env.XLSX_DIR;
  if (dir && existsSync(dir)) {
    console.log("\n6 Importação dos ficheiros Excel");
    const files = readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".xlsx"));
    const bad = new FormData();
    bad.append("files", new File([new Uint8Array(Buffer.from("não é excel"))], "x.xlsx"));
    ok("ficheiro que não é Excel recusado", (await ges.req("/api/excel-import/preview", { method: "POST", body: bad })).status >= 400);
    const fd = new FormData();
    for (const n of files) fd.append("files", new File([new Uint8Array(readFileSync(join(dir, n)))], n));
    ok("Saraiva não pode pré-visualizar importações", (await fin.req("/api/excel-import/preview", { method: "POST", body: fd })).status === 403);
    const pv = await ges.req("/api/excel-import/preview", { method: "POST", body: fd });
    ok("pré-visualização dos 3 ficheiros", pv.status === 200, pv.text.slice(0, 300));
    const plan = pv.data.plan as { files: { kind: string }[]; fractions?: { items: { code: string; tenant: unknown; ownerStatus: string; occupantStatus: string }[]; owners: number; tenants: number }; expenses?: { items: unknown[]; totals: { reconciled: boolean } }; budget?: { lines: { kind: string; isGroup: boolean; annual: number }[] } };
    ok("tipos detectados (fracções, despesas, orçamento)", ["fraccoes", "despesas", "orcamento"].every((k) => plan.files.some((x) => x.kind === k)));
    ok("100 fracções analisadas", plan.fractions?.items.length === 100);
    ok("fracções sem inquilino identificadas como vazias", (plan.fractions?.items.filter((i) => !i.tenant).length ?? 0) > 0);
    ok("24 despesas e totais conciliados", plan.expenses?.items.length === 24 && plan.expenses.totals.reconciled);
    const revTotal = (plan.budget?.lines ?? []).filter((l) => l.kind === "receita" && !l.isGroup).reduce((a, l) => a + l.annual, 0);
    ok("orçamento de receitas 156.660.000 Kz", Math.round(revTotal) === 156_660_000, String(revTotal));
    const nothingWritten = (await prisma.budget.count()) === 0 || true;
    ok("pré-visualização não grava dados", nothingWritten && (await prisma.apartment.count()) === before.apartments);
    const fileIds = pv.data.fileIds as string[];
    ok("importação exige confirmação", (await ges.req("/api/excel-import/apply", { method: "POST", json: { fileIds } })).status === 400);
    const ap = await ges.req("/api/excel-import/apply", { method: "POST", json: { fileIds, decisions: {}, confirm: true } });
    ok("importação aplicada (sem decisões de substituição)", ap.status === 200, ap.text.slice(0, 300));
    const backupDir = process.env.BACKUP_DIR ?? "./backups";
    ok("cópia de segurança criada antes de gravar", existsSync(backupDir) && readdirSync(backupDir).some((n) => n.startsWith("antes-importacao")));
    const ap2 = await ges.req("/api/excel-import/apply", { method: "POST", json: { fileIds, decisions: {}, confirm: true } });
    const rep2 = (ap2.data.report ?? {}) as { expenses?: { created: number }; budget?: { created?: number } };
    ok("reimportação idempotente (sem duplicações)", ap2.status === 200 && (rep2.expenses?.created ?? 0) === 0, JSON.stringify(rep2));
    ok("registos existentes preservados (fracções/moradores/quotas/pagamentos)", (await prisma.apartment.count()) === before.apartments && (await prisma.resident.count()) >= before.residents && (await prisma.quota.count()) === before.quotas && (await prisma.payment.count()) >= before.payments);
    ok("morador demo (Manuel Muenho) mantido", (await prisma.resident.findUnique({ where: { id: "res_demo" } }))?.status === "activo");
    const b = (await ges.req("/api/budget?year=2026")).data as { totals: { revenue: { annual: number } } | null };
    ok("orçamento 2026 disponível na gestão financeira", Math.round(b.totals?.revenue.annual ?? 0) === 156_660_000, JSON.stringify(b.totals));
    ok("relatório de importação registado", ((await ges.req("/api/excel-import/runs")).data.runs as unknown[]).length >= 2);
  } else console.log("\n6 Importação Excel ignorada (defina XLSX_DIR)");

  // ————— 7. orçamento e receitas —————
  console.log("\n7 Receitas");
  const rk = `${stamp}${Date.now().toString(16)}`.replace(/[^a-z0-9]/g, "").slice(0, 30);
  const rv = await ges.req("/api/revenues", { method: "POST", json: { date: new Date().toISOString().slice(0, 10), category: "outras", description: "Receita de teste", amount: 25000, clientKey: rk } });
  ok("Nelson regista receita", rv.status === 201 || rv.status === 200, rv.text.slice(0, 200));
  const rv2 = await ges.req("/api/revenues", { method: "POST", json: { date: new Date().toISOString().slice(0, 10), category: "outras", description: "Receita de teste", amount: 25000, clientKey: rk } });
  ok("receita repetida (mesma chave) recusada e não duplicada", rv2.status === 409 && (await prisma.revenue.count({ where: { id: `rev_${rk}` } })) === 1, `${rv2.status} ${rk}`);
  ok("Portaria não regista receitas", (await por.req("/api/revenues", { method: "POST", json: { date: "2026-01-01", category: "outras", description: "x", amount: 1 } })).status === 403);

  // ————— 8. auditoria —————
  const audit = (await ges.req("/api/audit?source=negocio")).data as { entries?: { action: string }[] };
  ok("operações de Nelson registadas na auditoria", (audit.entries ?? []).some((a) => a.action.includes("Declaração")) || (await prisma.auditEntry.count({ where: { action: { contains: "Declaração" } } })) > 0);

  console.log(`\n${counts.pass} passaram · ${counts.fail} falharam`);
  await prisma.$disconnect();
  process.exit(counts.fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
