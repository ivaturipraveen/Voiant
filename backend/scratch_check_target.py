import asyncio
from decimal import Decimal
from app.runtime import AppRuntime
from app.settings import Settings
from app.domain.engine.quota_equity import compute
from app.domain.models import Rep

async def main():
    settings = Settings()
    rt = AppRuntime(settings)
    rt.bootstrap_synthetic()
    
    cfg = rt.config_loader.current()
    print("CONFIG VERSION:", cfg.version)
    for seg in cfg.segment_definitions:
        print(f"Segment: {seg.name}, Target: {getattr(seg, 'target', 'MISSING')}")
        
    reps = [Rep.model_validate(r) for r in rt.snapshot.masked_reps]
    report = compute(reps, cfg, "synthetic")
    
    for s in report.segments:
        print(f"Segment: {s.segment}, Target: {s.company_target}, Over: {s.over_assignment}")
        
if __name__ == "__main__":
    asyncio.run(main())
