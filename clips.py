from config import CLIPS_DIR
from datetime import datetime
from flask import Blueprint, Response, render_template, request, send_file
import json
import mimetypes
import os
from typing import NamedTuple

GROUP_NAME_SEP = "."
GROUP_NAME_DATE_FORMAT = "%Y-%m-%d"
CLIP_NAME_SEP = "_"

bp = Blueprint("clips", __name__, url_prefix="/clips")

def parse_group_name(name:str)->tuple[str, datetime]:
    """Parses a group name into a competition name and the utc datetime for when the competition happened."""
    compname, datestr = name.rsplit(GROUP_NAME_SEP, 1) #"competition_name.%Y-%m-%d"
    return compname, datetime.strptime(datestr, GROUP_NAME_DATE_FORMAT)

def format_group_name(name:str, dt:datetime)->str:
    """Formats a competition name and competition date into a group name."""
    return GROUP_NAME_SEP.join((name, dt.strftime(GROUP_NAME_DATE_FORMAT)))

def parse_clip_name(name:str)->tuple[int, int]|None:
    """Parses the match type and number from a clip name."""
    split = name.rsplit(".", 1)
    if CLIP_NAME_SEP in split[0]:
        type, number = split[0].split(CLIP_NAME_SEP, 1)
        if type.isdigit() and number.isdigit():
            return int(type), int(number)
    return None
    
def format_clip_name(type:int, number:int, file_format:str|None=None)->str:
    """Formats a clip name from a match type, number, and a file format."""
    name = f"{type}{CLIP_NAME_SEP}{number}"
    if file_format is None:
        return name
    elif file_format.startswith("."):
        return name + file_format
    else:
        return f"{name}.{file_format}"

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

class Clip(NamedTuple):
    """
    Named tuple for containing detailed clip data.

    `name`          - The clip's name (full)

    `match`         - Match type for the clip

    `number`        - Number value for the match (depends on match type)

    `file_format`   - File format that the clip uses
    """
    name:str
    match:int
    number:int
    file_format:str

class ClipGroup(NamedTuple):
    """
    Named tuple for containing detailed clip group data.

    `name`          - The group name (competition name)

    `date`          - Date when the match happened

    `clips`         - List of clips that the group contains
    """
    name:str
    date:datetime
    clips:list[Clip]
    
def detailed_clips_tree(tree:dict[str, list[str]])->dict[str, ClipGroup]:
    """Parses each group and clip name from a normal clips tree to create a more detailed tree."""
    detailed = {}
    for groupname, clips in tree.items():
        group = ClipGroup(*parse_group_name(os.path.basename(groupname)), [
            Clip(clipname, *parse_clip_name(os.path.basename(clipname)), clipname.rsplit(".", 1)[-1]) for clipname in clips
        ])
        detailed[groupname] = group
    return detailed

def construct_path(comp_name:str, dt:datetime, type:int, number:int, file_format:str|None=None):
    """Construct a path containing the clip group and clip given their components."""
    group_name = format_group_name(comp_name, dt)
    clip_name = format_clip_name(type, number, file_format)
    return os.path.join(group_name, clip_name)

#request handlers

@bp.get("/tree")
def get_clips_tree():
    tree = read_clips_tree(as_paths=False)
    response = Response(json.dumps(tree), 200)
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    return response

@bp.get("/load/<group_name>/<clip_name>")
def load_clip(group_name:str, clip_name:str):
    path = os.path.join(CLIPS_DIR, group_name, clip_name)
    range_header = request.headers.get("Range", None)
    if range_header is None:
        return send_file(path, download_name=clip_name, mimetype=mimetypes.guess_type(path)[0])
    elif not os.path.isfile(path):
        return render_template("bases/error.html", ERROR_TITLE="Clips | 404", ERROR_NAME="Not Found", ERROR_CODE=404, ERROR_BODY="Unable to find the requested clip."), 400
    size = os.path.getsize(path)
    unit_parts = range_header.split("=", 1)
    if unit_parts[0] == "bytes" and len(unit_parts) > 1:
        range_parts = unit_parts[1].split("-", 1)
        if len(range_parts) == 2 and range_parts[0].isdecimal():
            start = int(range_parts[0])
            end = int(range_parts[1]) if range_parts[1] else None
            length = size - start if end is None else end - start
            if length > 0:
                with open(path, "rb") as f:
                    f.seek(start)
                    response = Response(f.read(length), 206, mimetype=mimetypes.guess_type(path)[0], direct_passthrough=True)
                response.headers.add("Content-Range", f"bytes {start}-{start+length-1}/{size}")
                
                return response
            
    response = Response(render_template(
            "bases/error.html",
            ERROR_TITLE="Clips | 416",
            ERROR_NAME="Range Not Satisfiable",
            ERROR_CODE=416,
            ERROR_BODY="Unable to load part of the clip from the specified range."
        ), 416)
    response.headers["Content-Range"] = f"bytes */{size}"
    return response
