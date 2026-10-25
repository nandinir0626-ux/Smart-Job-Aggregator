from typing import Dict, List
from sources.base import JobSource
from sources.remotive import RemotiveSource
from sources.arbeitnow import ArbeitnowSource
from sources.greenhouse import GreenhouseSource
from sources.lever import LeverSource

_SOURCES: Dict[str, JobSource] = {
    "remotive": RemotiveSource(),
    "arbeitnow": ArbeitnowSource(),
    "greenhouse": GreenhouseSource(),
    "lever": LeverSource()
}

def get_source(name: str) -> JobSource:
    return _SOURCES.get(name.lower())

def get_all_sources() -> List[JobSource]:
    return list(_SOURCES.values())

def register_source(source: JobSource):
    _SOURCES[source.name.lower()] = source
