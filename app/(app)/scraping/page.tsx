"use client";

import { useState } from "react";
import Link from "next/link";
import { JobListing, ScrapeRequest, ScrapeResponse, triggerScrape, getScrapedJobs } from "@/lib/api";

const TARGET_ROLES = [
  "Frontend React Developer",
  "Backend Developer",
  "Full Stack Developer",
  "MERN Stack Developer",
  "GenAI Developer",
  "GenAI + Full Stack",
  "GenAI + Backend",
  "GenAI + Agentic AI",
  "Android (Expo React Native) Developer",
  "Python Developer",
  "FastAPI Developer",
  "Express / Node Developer",
];

export default function ScrapingPage() {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResponse | null>(null);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setScrapeResult(null);
    try {
      // In a real app we'd trigger a background job and poll, but for this MVP we await
      const res = await triggerScrape({ roles: selectedRoles, max_results_per_role: 10 });
      setScrapeResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scraping failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#f6f8fc" }}>
      {/* ─── HEADER ─── */}
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e0e0e0", position: "sticky", top: 0, zIndex: 40 }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1a73e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              🕵️
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 16, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', lineHeight: 1.2 }}>Job Scraper</p>
              <p style={{ fontSize: 11, color: "#5f6368", fontFamily: "Roboto, sans-serif" }}>Autonomous stealth job hunting</p>
            </div>
          </div>
          <nav className="flex gap-2">
            <Link href="/" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Mail</Link>
            <Link href="/forms" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Forms</Link>
            <Link href="/scraping" className="btn-primary" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Scraping</Link>
            <div style={{ width: 1, backgroundColor: "#e0e0e0", margin: "0 4px" }} />
            <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Dashboard</Link>
            <Link href="/profile" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Profile</Link>
          </nav>
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <div className="text-center mb-8 fade-in">
          <h1 style={{ fontSize: 36, fontWeight: 700, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', marginBottom: 12, letterSpacing: "-0.01em" }}>
            Scrape Job Listings
          </h1>
          <p style={{ color: "#5f6368", fontSize: 16, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            Select target roles to search the web using headless browsers. The agent automatically bypasses bot checks and skips unallowed sites.
          </p>
        </div>

        <div className="hud-card p-6 mb-8 fade-in">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Select Roles to Target</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {TARGET_ROLES.map(role => (
              <label key={role} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                <input 
                  type="checkbox" 
                  checked={selectedRoles.includes(role)} 
                  onChange={() => toggleRole(role)}
                  style={{ accentColor: "#1a73e8", width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14, color: "#3c4043" }}>{role}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
             <div className="text-sm text-gray-500">
               {selectedRoles.length === 0 ? "All roles will be searched if none selected" : `${selectedRoles.length} roles selected`}
             </div>
             <button
               className="btn-primary flex items-center gap-2"
               onClick={handleScrape}
               disabled={loading}
               style={{ padding: "10px 24px", fontSize: 14, borderRadius: 20 }}
             >
               {loading ? <><div className="spinner" /> Scraping Web...</> : <>🚀 Start Scraping</>}
             </button>
          </div>
        </div>

        {error && (
          <div className="hud-card fade-in mb-6" style={{ padding: 12, borderColor: "#ea4335", background: "#fce8e6", borderRadius: 8 }}>
            <p style={{ fontSize: 13, color: "#c5221f", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠</span> {error}
            </p>
          </div>
        )}

        {scrapeResult && (
          <div className="fade-in mb-8">
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
              Results Found: {scrapeResult.new_jobs} new ({scrapeResult.duplicates_skipped} duplicates skipped)
            </h2>
            
            {scrapeResult.jobs.length === 0 ? (
              <div className="hud-card p-8 text-center text-gray-500">
                No new jobs found matching the criteria.
              </div>
            ) : (
              <div className="grid gap-4">
                {scrapeResult.jobs.map((job, idx) => (
                  <div key={idx} className="hud-card p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <h3 className="text-lg font-bold text-gray-900">{job.role}</h3>
                         <p className="text-sm font-medium text-blue-600">{job.company_name || 'Hidden Company'} • {job.location || 'Remote'}</p>
                       </div>
                       {job.salary && <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-semibold border border-green-200">{job.salary}</span>}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-2">{job.description || job.company_detail}</p>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                       <div className="text-xs text-gray-400">
                          Found via: {job.source_site} | Exp: {job.experience_required || "Not specified"}
                       </div>
                       {job.job_apply_link && (
                         <a href={job.job_apply_link} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline">
                           Apply External →
                         </a>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
