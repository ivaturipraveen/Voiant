from pydantic import BaseModel
from decimal import Decimal

class Tag(BaseModel):
    label: str
    color_scheme: str  # "red", "yellow", "green", "slate"

class RecommendationCard(BaseModel):
    id: str
    priority_num: str
    priority_label: str
    priority_color: str # hex color
    title: str
    description: str
    tags: list[Tag]
    impact_dollars: str
    effort: str
    confidence_level: str
    confidence_icon: str

class RecommendationsReport(BaseModel):
    aggregate_impact: str
    cards: list[RecommendationCard]
    client_name: str
    company_target_str: str
    snapshot_date_str: str
    refresh_cadence: str
