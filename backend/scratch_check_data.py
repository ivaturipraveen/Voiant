import asyncio
from app.runtime import AppRuntime
from app.settings import Settings
from app.domain.engine.quota_equity import compute
from app.domain.models import Rep

async def main():
    settings = Settings()
    rt = AppRuntime(settings)
    rt.bootstrap_synthetic()
    
    reps = [Rep.model_validate(r) for r in rt.snapshot.masked_reps]
    cfg = rt.config_loader.current()
    
    report = compute(reps, cfg, "synthetic")
    
    print("--- SEGMENTS ---")
    for s in report.segments:
        print(f"Segment: {s.segment} | Reps: {s.rep_count} | Deployed: {float(s.deployed_quota)/1_000_000:.1f}M | Paintbrushed: {s.is_paintbrushed}")
        
    print("\n--- HEATMAP ---")
    for cell in report.heatmap:
        print(f"{cell.segment} / {cell.region} | Ratio: {cell.fairness_ratio:.2f} | Band: {cell.band.value}")
        
if __name__ == "__main__":
    asyncio.run(main())
