"""
Load test for the public read + write endpoints (docs/PERFORMANCE.md
"Core Web Vitals target" / "load-testing key endpoints").

    locust -f locustfile.py --host https://staging.mdsrebar.example
    # headless, 200 users, spawn 20/s, 5 min:
    locust -f locustfile.py --host <url> --headless -u 200 -r 20 -t 5m

Not part of CI (needs a running target + realistic data). Run against
staging before a release and compare p95 latency + error rate to the
budget in the SLA. The write task uses the honeypot field so it exercises
the throttle / validation path without creating rows.
"""
from __future__ import annotations

import random

from locust import HttpUser, between, task


class PublicVisitor(HttpUser):
    wait_time = between(1, 5)

    @task(10)
    def home_page_content(self):
        self.client.get("/api/v1/pages/home/", name="/pages/{key}")

    @task(8)
    def services(self):
        self.client.get("/api/v1/services/", name="/services")

    @task(4)
    def service_detail(self):
        self.client.get("/api/v1/services/rebar-detailing/", name="/services/{slug}")

    @task(6)
    def portfolio(self):
        page = random.randint(1, 3)
        self.client.get(f"/api/v1/portfolio/?page={page}", name="/portfolio?page")

    @task(6)
    def news(self):
        self.client.get("/api/v1/news/", name="/news")

    @task(5)
    def search(self):
        term = random.choice(["rebar", "detailing", "bim", "estimation", "bridge"])
        self.client.get(f"/api/v1/search/?q={term}", name="/search?q")

    @task(3)
    def resources(self):
        self.client.get("/api/v1/resources/", name="/resources")

    @task(1)
    def contact_submit_is_rejected_by_honeypot(self):
        self.client.post(
            "/api/v1/contact/",
            json={"name": "load", "email": "load@example.com", "message": "x", "website": "bot"},
            name="/contact [honeypot]",
        )
