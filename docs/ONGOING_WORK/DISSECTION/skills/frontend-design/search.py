#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Design Intelligence - BM25 Search Engine
Simplified version (~100 lines) for style, color, typography, and chart recommendations.
"""

import csv
import re
import sys
from pathlib import Path
from math import log
from collections import defaultdict

# ============ CONFIGURATION ============
DATA_DIR = Path(__file__).parent / "data"
MAX_RESULTS = 3
DEFAULT_QUERY = "SaaS premium minimal clean apple whitespace"

CSV_CONFIG = {
    "style": {
        "file": "styles.csv",
        "search_cols": ["Style Category", "Keywords", "Best For", "Type"],
        "output_cols": ["Style Category", "Type", "Keywords", "Primary Colors", "Effects & Animation", "Best For"]
    },
    "color": {
        "file": "colors.csv",
        "search_cols": ["Product Type", "Notes"],
        "output_cols": ["Product Type", "Primary (Hex)", "Secondary (Hex)", "CTA (Hex)", "Background (Hex)", "Text (Hex)", "Notes"]
    },
    "typography": {
        "file": "typography.csv",
        "search_cols": ["Font Pairing Name", "Category", "Mood/Style Keywords", "Best For"],
        "output_cols": ["Font Pairing Name", "Category", "Heading Font", "Body Font", "Mood/Style Keywords", "Best For", "Google Fonts URL"]
    },
    "chart": {
        "file": "charts.csv",
        "search_cols": ["Data Type", "Keywords", "Best Chart Type"],
        "output_cols": ["Data Type", "Keywords", "Best Chart Type", "Secondary Options", "Color Guidance", "Library Recommendation"]
    }
}


# ============ BM25 IMPLEMENTATION ============
class BM25:
    """BM25 ranking algorithm for text search (k1=1.5, b=0.75)"""

    def __init__(self, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.corpus, self.doc_lengths, self.avgdl = [], [], 0
        self.idf, self.doc_freqs, self.N = {}, defaultdict(int), 0

    def tokenize(self, text):
        text = re.sub(r'[^\w\s]', ' ', str(text).lower())
        return [w for w in text.split() if len(w) > 2]

    def fit(self, documents):
        self.corpus = [self.tokenize(doc) for doc in documents]
        self.N = len(self.corpus)
        if self.N == 0: return
        self.doc_lengths = [len(doc) for doc in self.corpus]
        self.avgdl = sum(self.doc_lengths) / self.N
        for doc in self.corpus:
            for word in set(doc):
                self.doc_freqs[word] += 1
        for word, freq in self.doc_freqs.items():
            self.idf[word] = log((self.N - freq + 0.5) / (freq + 0.5) + 1)

    def score(self, query):
        query_tokens = self.tokenize(query)
        scores = []
        for idx, doc in enumerate(self.corpus):
            score, doc_len = 0, self.doc_lengths[idx]
            term_freqs = defaultdict(int)
            for word in doc: term_freqs[word] += 1
            for token in query_tokens:
                if token in self.idf:
                    tf, idf = term_freqs[token], self.idf[token]
                    score += idf * (tf * (self.k1 + 1)) / (tf + self.k1 * (1 - self.b + self.b * doc_len / self.avgdl))
            scores.append((idx, score))
        return sorted(scores, key=lambda x: x[1], reverse=True)


# ============ SEARCH FUNCTIONS ============
def detect_domain(query):
    """Auto-detect domain from query keywords"""
    q = query.lower()
    if any(kw in q for kw in ["color", "palette", "hex"]): return "color"
    if any(kw in q for kw in ["chart", "graph", "trend", "pie"]): return "chart"
    if any(kw in q for kw in ["font", "typography", "heading"]): return "typography"
    return "style"


def search(query, domain=None, max_results=MAX_RESULTS):
    """Main search function with auto-domain detection"""
    if domain is None:
        domain = detect_domain(query)

    config = CSV_CONFIG.get(domain, CSV_CONFIG["style"])
    filepath = DATA_DIR / config["file"]

    if not filepath.exists():
        return {"error": f"File not found: {filepath}", "domain": domain, "results": []}

    with open(filepath, 'r', encoding='utf-8') as f:
        data = list(csv.DictReader(f))

    documents = [" ".join(str(row.get(col, "")) for col in config["search_cols"]) for row in data]

    bm25 = BM25()
    bm25.fit(documents)
    ranked = bm25.score(query)

    results = []
    for idx, score in ranked[:max_results]:
        if score > 0:
            row = data[idx]
            result = {col: row.get(col, "") for col in config["output_cols"] if col in row}
            result["_score"] = round(score, 2)
            results.append(result)

    return {"domain": domain, "query": query, "count": len(results), "results": results}


def print_results(result):
    """Pretty print search results"""
    print(f"\n=== FRONTEND DESIGN SEARCH ===")
    print(f"Query: {result['query']}")
    print(f"Domain: {result['domain']}")
    print(f"Results: {result['count']}")

    if "error" in result:
        print(f"Error: {result['error']}")
        return

    for i, r in enumerate(result["results"], 1):
        print(f"\n--- Result {i} (score: {r.get('_score', 'N/A')}) ---")
        for k, v in r.items():
            if k != "_score" and v:
                print(f"{k}: {v}")


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_QUERY
    result = search(query)
    print_results(result)
