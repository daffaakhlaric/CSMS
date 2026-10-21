"use client";
import { useId, useState } from "react";
export default function SearchSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId(),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const filtered = options.filter((o) =>
    `${o.value} ${o.label}`
      .toLocaleLowerCase("id")
      .includes(query.toLocaleLowerCase("id")),
  );
  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }
  return (
    <div
      className="eam-combo"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setActive(0);
        }}
      >
        {options.find((o) => o.value === value)?.label ||
          `Pilih ${label.toLowerCase()}`}{" "}
        <small>⌕</small>
      </button>
      {open && (
        <div className="eam-combo-popup">
          <input
            autoFocus
            aria-label={`Cari ${label}`}
            value={query}
            placeholder={`Ketik kode atau nama ${label.toLowerCase()}…`}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, filtered.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && filtered[active]) {
                e.preventDefault();
                choose(filtered[active].value);
              }
            }}
          />
          <div id={id} role="listbox" aria-label={label}>
            {filtered.slice(0, 100).map((o, i) => (
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={i === active ? "highlight" : ""}
                key={o.value}
                onClick={() => choose(o.value)}
              >
                {o.label}
              </button>
            ))}
            {!filtered.length && <p>Tidak ada pilihan yang cocok.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
