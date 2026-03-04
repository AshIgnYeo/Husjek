"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("husjek-role");
    if (saved) {
      setRole(saved);
      window.location.href = saved === "wife" ? "/wife" : "/husband";
    }
  }, []);

  function selectRole(r: "wife" | "husband") {
    localStorage.setItem("husjek-role", r);
    window.location.href = r === "wife" ? "/wife" : "/husband";
  }

  if (role) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6">
      <div className="bounce-in text-center mb-12">
        <div className="text-6xl mb-4">🚗</div>
        <h1 className="text-4xl font-bold mb-2">Husjek</h1>
        <p className="text-gray-400 text-lg">Your personal pickup service</p>
      </div>

      <div className="w-full max-w-sm space-y-4 slide-up">
        <p className="text-center text-gray-300 mb-6">Who are you?</p>

        <button
          onClick={() => selectRole("wife")}
          className="w-full py-5 px-6 bg-pink-600 hover:bg-pink-500 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <span className="text-2xl">👸</span>
          I need a pickup
        </button>

        <button
          onClick={() => selectRole("husband")}
          className="w-full py-5 px-6 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <span className="text-2xl">🏎️</span>
          I am the driver
        </button>
      </div>

      <p className="text-gray-600 text-sm mt-12">
        Husband + Gojek = Husjek
      </p>
    </div>
  );
}
