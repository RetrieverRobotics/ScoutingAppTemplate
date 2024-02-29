from datetime import datetime, timezone
from flask import Blueprint, send_file
import json
import os

CLIPS_DIR = "clips"

GROUP_NAME_SEP = "."
GROUP_NAME_DATE_FORMAT = "%Y-%m-%d"
CLIP_NAME_PREFIX = "match_"

bp = Blueprint("clips", __name__, url_prefix="/clips")

def parse_group_name(name:str)->tuple[str, datetime]:
    """Parses a group name into a competition name and the utc datetime for when the competition happened."""
    compname, datestr = name.rsplit(GROUP_NAME_SEP, 1) #"competition_name.%Y-%m-%d"
    return compname, datetime.strptime(datestr, GROUP_NAME_DATE_FORMAT).replace(tzinfo=timezone.utc)

def format_group_name(name:str, dt:datetime)->str:
    """Formats a competition name and competition date into a group name."""
    return GROUP_NAME_SEP.join((name, dt.strftime(GROUP_NAME_DATE_FORMAT)))

def parse_clip_name(name:str)->int|None:
    """Parses the match number from a clip name."""
    if name.startswith(CLIP_NAME_PREFIX):
        start = len(CLIP_NAME_PREFIX)
        return int(name[start:name.index(".", start=start+1)])
    else:
        return None
    
def format_clip_name(match:int, file_format:str|None=None)->str:
    """Formats a clip name from a match number and a file format."""
    name = CLIP_NAME_PREFIX + str(match)
    if file_format is not None:
        if file_format.startswith("."):
            name += file_format
        else:
            name += "." + file_format
    return name

def read_clips_tree(dir=CLIPS_DIR, as_paths=False)->dict[str, list[str]]:
    """
    Goes through specified directory and collects all clip groups and their clips.
    If `as_paths` is True, then the group and clip names will be stored as paths
    relative to the clip directory's parent. Otherwise, only the names will be stored.
    """
    tree = {}
    for groupname in os.listdir(dir):
        grouppath = os.path.join(dir, groupname)
        clips = tree[grouppath if as_paths else groupname] = []
        for clipname in os.listdir(grouppath):
            clips.append(os.path.join(grouppath, clipname) if as_paths else clipname)
    return tree

def construct_path(comp_name:str, dt:datetime, match:int, file_format:str|None=None):
    """Construct a path containing the clip group and clip given their components."""
    group_name = format_group_name(comp_name, dt)
    clip_name = format_clip_name(match, file_format)
    return os.path.join(group_name, clip_name)

#request handlers

@bp.get("/tree")
def get_clips_tree():
    tree = read_clips_tree(as_paths=False)
    return json.dumps(tree), 200, {"Content-Type":"application/json; charset=utf-8"}

@bp.get("/load/<group_name>/<clip_name>")
def load_clip(group_name:str, clip_name:str):
    path = os.path.join(CLIPS_DIR, group_name, clip_name)
    return send_file(path, download_name=clip_name)
