from exa_py import Exa
import os

class ExaClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.exa = Exa(api_key)

    def search(self, query: str, num_results: int = 10, type: str = "auto", category: str = None, include_domains: list = None, exclude_domains: list = None):
        try:
            result = self.exa.search(
                query=query,
                num_results=num_results,
                type=type,
                category=category,
                include_domains=include_domains,
                exclude_domains=exclude_domains
            )
            return result # Return the raw Exa object
        except Exception as e:
            print(f"Error during EXA API call: {e}")
            return {"error": str(e)}

    def get_contents(self, ids: list):
        try:
            result = self.exa.get_contents(ids)
            return result # Return the raw Exa object
        except Exception as e:
            print(f"Error during EXA get_contents API call: {e}")
            return {"error": str(e)}

    def search_and_contents(self, query: str, num_results: int = 10, type: str = "auto", category: str = None, include_domains: list = None, exclude_domains: list = None, text: bool = False):
        try:
            result = self.exa.search_and_contents(
                query=query,
                num_results=num_results,
                type=type,
                category=category,
                include_domains=include_domains,
                exclude_domains=exclude_domains,
                text=text
            )
            return result # Return the raw Exa object
        except Exception as e:
            print(f"Error during EXA search_and_contents API call: {e}")
            return {"error": str(e)}
