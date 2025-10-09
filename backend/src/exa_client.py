import requests
import os

class ExaClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.exa.ai"

    def search(self, query: str, num_results: int = 10, type: str = "auto", category: str = None, include_domains: list = None, exclude_domains: list = None):
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "query": query,
            "numResults": num_results,
            "type": type
        }
        if category:
            payload["category"] = category
        if include_domains:
            payload["includeDomains"] = include_domains
        if exclude_domains:
            payload["excludeDomains"] = exclude_domains

        try:
            response = requests.post(f"{self.base_url}/search", headers=headers, json=payload)
            response.raise_for_status()  # Raise an exception for HTTP errors
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error during EXA API call: {e}")
            return {"error": str(e)}

    def get_contents(self, ids: list):
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "ids": ids
        }
        try:
            response = requests.post(f"{self.base_url}/getContents", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error during EXA get_contents API call: {e}")
            return {"error": str(e)}
