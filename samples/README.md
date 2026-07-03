# Sample CSVs — how to test data ingestion

Three sample files that exercise the ingestion + Shield masking path.

| File | Shows |
| --- | --- |
| `reps_basic.csv` | Standard columns (`name, email, segment, region, quota, pipeline`). |
| `reps_aliased.csv` | **Different** column names (`full_name, work_email, geo, annual_quota, open_pipeline`) — proves the connector's alias mapping. |
| `reps_pii.csv` | Includes **phone numbers** — good for demoing Shield PII masking on upload. |

## Two ways to use them

### 1. Upload in the UI (quickest)
1. Open the app → the **Secure Ingestion (CSV / Excel)** panel on the right (Admin/Analyst role).
2. Click **Upload & mask through Shield** and pick a file.
3. You'll see rows ingested, entities detected, and a masked preview
   (`John Smith → [PERSON 1]`, numbers stay clear). *Requires Bright Shield to be active.*

### 2. Use a file as the app's data source
Point the backend at a CSV instead of synthetic/DB:
```bash
# in backend/.env
VOIANT_DATA_SOURCE=csv
VOIANT_DATA_CSV_PATH=../samples/reps_basic.csv
```
Restart the backend — the dashboards now run on that file's reps.

### 3. Generate a full 80-rep dataset
```bash
cd backend
python scripts/generate_dataset.py --output data/reps.csv   # editable CSV of the full synthetic set
```

## Column mapping (any of these header names work)
| Canonical field | Accepted headers |
| --- | --- |
| display_name | display_name, name, rep_name, full_name, rep |
| email | email, email_address, work_email |
| segment | segment, segment_name |
| region | region, geo, area |
| quota | quota, deployed_quota, annual_quota |
| pipeline_value | pipeline_value, pipeline, open_pipeline |
| attainment | attainment, attainment_pct, quota_attainment |
