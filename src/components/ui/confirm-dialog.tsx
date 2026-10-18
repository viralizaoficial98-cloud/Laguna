"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./modal";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 pt-2">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-red-50 text-red-600" : "bg-navy-50 text-navy-700"}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-navy-900">{title}</h3>
          {description && <p className="mt-1 text-sm text-graphite-500">{description}</p>}
        </div>
      </div>
    </Modal>
  );
}
