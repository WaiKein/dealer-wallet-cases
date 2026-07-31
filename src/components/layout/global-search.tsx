"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GlobalSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      className="hidden min-w-0 flex-1 md:block"
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        router.push(q ? `/cases?search=${encodeURIComponent(q)}` : "/cases");
      }}
    >
      <label className="sr-only" htmlFor="global-search">
        Search cases or commands
      </label>
      <input
        id="global-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search cases or commands..."
        className="h-9 w-full max-w-xl rounded-full border bg-background px-4 text-sm"
      />
    </form>
  );
}
