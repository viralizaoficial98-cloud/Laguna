"use client";

import type { CircularRecipients } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { BLOCKS } from "@/data/management";
import { cn } from "@/lib/utils";

/** Selecção de blocos e apartamentos destinatários de uma circular. */
export function RecipientsPicker({ value, onChange }: { value: CircularRecipients; onChange: (v: CircularRecipients) => void }) {
  const apartments = useDemoStore((s) => s.apartments);
  const blocks = Array.from(new Set([...BLOCKS, ...apartments.map((a) => a.block)])).sort();

  const toggleBlock = (b: string) => {
    const next = { ...value.blocks };
    if (b in next) delete next[b];
    else next[b] = [];
    onChange({ ...value, blocks: next });
  };
  const toggleApt = (b: string, n: string) => {
    const cur = value.blocks[b] ?? [];
    onChange({ ...value, blocks: { ...value.blocks, [b]: cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort() } });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["todos", "seleccao"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ ...value, mode: m })}
            className={cn("rounded-full px-3.5 py-1.5 text-xs font-medium transition", value.mode === m ? "bg-navy-900 text-white" : "bg-graphite-100 text-graphite-600 hover:bg-graphite-200")}
          >
            {m === "todos" ? "Todos os condóminos" : "Blocos / apartamentos específicos"}
          </button>
        ))}
      </div>
      {value.mode === "seleccao" && (
        <div className="rounded-xl border border-graphite-100 p-3">
          <p className="mb-2 text-xs text-graphite-500">Blocos</p>
          <div className="flex flex-wrap gap-1.5">
            {blocks.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => toggleBlock(b)}
                className={cn("rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition", b in value.blocks ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-graphite-700 ring-graphite-200 hover:ring-navy-300")}
              >
                Bloco {b}
              </button>
            ))}
          </div>
          {Object.keys(value.blocks)
            .sort()
            .map((b) => {
              const apts = apartments.filter((a) => a.block === b && a.active).sort((x, y) => x.number.localeCompare(y.number));
              const sel = value.blocks[b];
              return (
                <div key={b} className="mt-3 border-t border-graphite-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-navy-900">
                    Bloco {b} <span className="font-normal text-graphite-500">— {sel.length ? `${sel.length} apartamento(s)` : "bloco inteiro"}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {apts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleApt(b, a.number)}
                        className={cn("rounded-md px-2 py-0.5 text-[11px] tabular-nums ring-1 transition", sel.includes(a.number) ? "bg-gold-100 text-gold-900 ring-gold-400" : "bg-white text-graphite-600 ring-graphite-200 hover:ring-gold-300")}
                      >
                        {a.number}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          <label className="mt-3 flex items-center gap-2 border-t border-graphite-100 pt-3 text-xs text-graphite-700">
            <input type="checkbox" className="h-4 w-4 accent-navy-900" checked={value.listInBody} onChange={(e) => onChange({ ...value, listInBody: e.target.checked })} />
            Apresentar a lista de blocos e apartamentos no corpo da circular
          </label>
        </div>
      )}
    </div>
  );
}
