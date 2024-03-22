from config import STRUCT_HOSTS_SCOPE, STRUCT_ROBOTS_SCOPE, STRUCT_TEAMS_SCOPE
import database
from datetime import datetime
import json
import os
from typing import Any

ATTR_UPDATED = "_updated"

#indent to give for json, `None` (no pretty format, all one line)
JSON_FILE_PRETTY = None
JSON_DIR_PRETTY = None

class MiscStructure:
    """
    Base class for Data contained by a Misc Structure.
    """

    def __new__(cls, *args, **kwargs):
        instance = super().__new__(cls)
        instance._updated = False
        return instance

    def __init__(self, id:int, **kwargs):
        self.id = id
        self.__dict__.update(kwargs)

    def __setattr__(self, name:str, value:Any)->None:
        super().__setattr__(name, value)
        if name != ATTR_UPDATED:
            self._updated = True #set after it happens, an error should prevent this from being set

    def getstate(self)->Any:
        """
        Get the structure's state.
        """
        raise NotImplementedError
    
    def setstate(self, state:Any):
        """
        Update the MiscStructure object with new state.
        """
        self._updated = False

class MiscStructureGroup[T:MiscStructure]:
    """
    Base class for group which manages entries of Misc Structures.
    """

    def __init__(self, scope:str, structure_t:type[T]):
        self.scope = scope
        self.structure_t = structure_t
        self.children:dict[int, T] = {} #id -> MiscStructure
        self._opened = False

    def __len__(self):
        return len(self.children)
    
    def __bool__(self):
        return self._opened and bool(self.children)
    
    def __iter__(self):
        for child in self.children.values():
            yield child

    def read(self)->dict[int, Any]:
        """
        Read the children's state from the location designated by the group's scope.
        """
        raise NotImplementedError
    
    def write(self):
        """
        Write the children's state to the location designated by the group's scope.
        """
        raise NotImplementedError
    
    def to_child(self, value:Any)->T:
        """
        Given a MiscStructure's state, return a MiscStructure instance.
        """
        instance = self.structure_t.__new__(self.structure_t)
        instance.setstate(value)
        return instance
    
    def from_child(self, child:T)->Any:
        """
        Given a child, returns its state.
        """
        return child.getstate()

    def open(self):
        """
        Reads all children of the group from the group's scope. 
        """
        if not self._opened:
            self.children = {id: self.to_child(value) for id, value in self.read().items()}
            self._opened = True

    def close(self):
        """
        Empties the group.
        """
        if self._opened:
            self.children.clear()
            self._opened = False
    
    def get(self, id:int):
        """
        Get a child from the group by its ID.
        """
        return self.children.get(id, None)

    def filter(self, **attrs):
        """
        Find all children which have attributes of the given values.
        """
        for child in self.children.values():
            for name, value in attrs.items():
                if name in child.__dict__ and child.__dict__[name] == value:
                    yield child

    def filter_first(self, **attrs):
        """
        Get the first child which has attributes of the given values.
        """
        try:
            return next(self.filter(**attrs))
        except StopIteration:
            return None

    def refresh(self):
        """
        Update the unmodified children in the group.
        New children will be added, but deleted children will be brought back.
        """
        for id, value in self.read().items():
            if id not in self.children:
                self.children[id] = self.to_child(value)
            elif not self.children[id]._updated:
                self.children[id].setstate(value)

    def add(self, child:T):
        """
        Add the MiscStructure to the group.
        """
        if child.id not in self.children:
            self.children[child.id] = child

    def remove(self, child:T):
        """
        Remove the child from the group.
        """
        if child.id in self.children:
            del self.children[child.id]

    def commit(self):
        """
        Commit the changes made to the group and its children.
        """
        self.write()
        for child in self.children.values():
            child._updated = False
    
    def rollback(self):
        """
        Discard the changes made to the group and its chilren.
        """
        r = self.read()

        for id in tuple(self.children.keys()):
            if id not in r: #was added
                del self.children[id]

        for id, value in r.items():
            if id in self.children: #just modified
                self.children[id].setstate(value)
            else: #was removed
                self.children[id] = self.to_child(value)



class JsonFileStructureGroup[T:MiscStructure](MiscStructureGroup[T]):
    """
    Group which manages entries of JSON Structures in a file.
    """

    def __init__(self, scope:str, structure_t:type[T], pretty:str=JSON_FILE_PRETTY):
        super().__init__(scope, structure_t)
        self.pretty = pretty

    def read(self)->dict[int, dict[str]]:
        if not os.path.isfile(self.scope):
            return {}
        with open(self.scope, "rb") as f:
            data:dict[str] = json.load(f)
        return {int(id): state for id, state in data.items()}
    
    def write(self):
        data = {str(id):self.from_child(child) for id, child in self.children.items()}
        #json formatting happens here, so that (file open -> truncate -> json.dump -> error -> lose data) doesnt happen 
        contents = json.dumps(data, indent=self.pretty)
        with open(self.scope, "w") as f:
            f.write(contents)

class JsonDirStructureGroup[T:MiscStructure](MiscStructureGroup[T]):
    """
    Group which manages entries of JSON Structures in a directory.
    """

    def __init__(self, scope:str, structure_t:type[T], pretty:str=JSON_DIR_PRETTY):
        super().__init__(scope, structure_t)
        self.pretty = pretty

    def read(self)->dict[int]:
        rtv = {}
        if os.path.isdir(self.scope):
            for fn in os.listdir(self.scope):
                if not fn.isdecimal():
                    continue
                path = os.path.join(self.scope, fn)
                with open(path, "rb") as f:
                    rtv[int(fn)] = json.load(f)
        return rtv
    
    def write(self):

        #get all new contents so that if there is an error, nothing is written
        to_write = {}

        if not os.path.isdir(self.scope):
            os.mkdir(self.scope)

        for id, child in self.children.items():
            path = os.path.join(self.scope, str(id))
            contents = json.dumps(self.from_child(child), indent=self.pretty)
            #if python can handle images, it can handle the contents of
            #multiple json files at once
            to_write[path] = contents
        
        for path, contents in to_write.items():
            with open(path, "w") as f:
                f.write(contents)

        #dont need to hang onto this any longer than necessary
        to_write.clear()
        del to_write
            
        #check for deleted
        for fn in os.listdir(self.scope):
            if fn.isdecimal() and int(fn) not in self.children:
                os.remove(os.path.join(os.path.join(self.scope, fn)))

class extradata:
    """
    Extra data contained by a MiscStruct.
    """

    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    def __getitem__(self, key:str):
        return self.__dict__[key]
    
    def __setitem__(self, key:str, value):
        self.__dict__[key] = value

    def __iter__(self):
        return iter(self.__dict__)
    
    def __len__(self):
        return len(self.__dict__)
    
    def __contains__(self, key:str):
        return key in self.__dict__


class HostEvent(extradata):
    """
    Data on a specific event of a event host.
    """

    def __init__(self, name:str, comp_year:int, date:str, venue_size:str|None=None, attendance:int|None=None, dropped_out:int|None=None, teams_outofstate:int|None=None,
                 field_count:int|None=None, match_field_count:int|None=None, practice_field_count:int|None=None, skills_field_count:int|None=None, comments:str="", **kwargs):
        self.name = name
        self.comp_year = comp_year
        self.date = date
        self.venue_size = venue_size
        self.attendance = attendance
        self.dropped_out = dropped_out
        self.teams_outofstate = teams_outofstate
        self.field_count = field_count
        self.match_field_count = match_field_count
        self.practice_field_count = practice_field_count
        self.skills_field_count = skills_field_count
        self.comments = comments
        super().__init__(**kwargs)


class Host(MiscStructure):
    """
    Contains data on event hosts.
    """

    @classmethod
    def create(cls, team_id:int|None=None, events:list[HostEvent|dict[str]]|None=None, comments:str="", dt:datetime|None=None):
        """
        Creates a new Host from the given team ID, events, and comments.

        A custom `datetime` can be specified for generating the Host's ID, but it is
        recommended that the current date and time is used.
        """
        return cls(id=database.generate_id(dt), team_id=team_id, events=events, comments=comments)

    def __init__(self, id:int, team_id:int|None=None, events:list[HostEvent|dict[str]]|None=None, comments:str="", **kwargs):
        super().__init__(id, **kwargs)
        self.team_id = team_id
        self.events = [data if isinstance(data, HostEvent) else HostEvent(**data) for data in events] if isinstance(events, list) else []
        self.comments = comments

    def find_year(self, year:int)->list[HostEvent]:
        """
        Find all events for the given year number.
        
        For the xxxa-xxxb year, you would pass `20xa` into `year`.
        """
        return [event for event in self.events if event.comp_year == year]
    
    def get_team(self):
        """
        Get the Team with the stored `team_id`.
        """
        return teams_group.get(self.team_id)

    def getstate(self)->Any:
        d = self.__dict__.copy()
        del d[ATTR_UPDATED]
        d["events"] = [event.__dict__.copy() for event in self.events]
        return d

    def setstate(self, state:dict[str]):
        self.__init__(**state)
        super().setstate(state)



class TeamSocial(extradata):
    """
    Data on a team's social media account.
    """

    def __init__(self, name:str, u_name:str, u_id:int|None=None, **kwargs):
        self.name = name
        self.u_name = u_name #account name
        self.u_id = u_id #account ID (immutable)
        super().__init__(**kwargs)


class TeamYear(extradata):
    """
    Data collected on team pertaining to a particular year.
    """

    def __init__(self, member_count:int|None=None, new_member_count:int|None=None, apparent_bal:str|None=None, robot_qual:str="",
                 strategy_type:str="", attitude:str|None=None, time_to_build:str="", scouting:str|None=None, comments:str="", **kwargs):
        self.member_count = member_count
        self.new_member_count = new_member_count
        self.apparent_bal = apparent_bal
        self.robot_qual = robot_qual
        self.strategy_type = strategy_type
        self.attitude = attitude
        self.time_to_build = time_to_build
        self.scouting = scouting
        self.comments = comments
        super().__init__(**kwargs)

    
class Team(MiscStructure):
    """
    Contains data on a team.
    """

    @classmethod
    def create(cls, name:str, years:dict[int, TeamYear|dict[str]]|None=None, socials:list[TeamSocial|dict[str]]|None=None, comments:str="", dt:datetime|None=None):
        """
        Creates a new Team from the given name, year info, socials, and comments.

        A custom `datetime` can be specified for generating the Team's ID, but it is
        recommended that the current date and time is used.
        """
        return cls(id=database.generate_id(dt), name=name, years=years, socials=socials, comments=comments)

    def __init__(self, id:int, name:str, years:dict[int, TeamYear|dict[str]]|None=None, socails:list[TeamSocial|dict[str]]|None=None, comments:str="", **kwargs):
        super().__init__(id, **kwargs)
        self.name = name
        self.years = {int(num): data if isinstance(data, TeamYear) else TeamYear(**data) for num, data in years.items()} if isinstance(years, dict) else {}
        self.socials = [data if isinstance(data, TeamSocial) else TeamSocial(**data) for data in socails] if isinstance(socails, list) else []
        self.comments = comments

    def get_year(self, year:int):
        """
        Gets data for the given year number.
        
        For the 20xa-20xb year, you would pass `20xa` into `year`.
        """
        return self.years.get(year, None)
    
    def get_robots(self):
        """
        Find all robots that belong to this team.
        """
        for robot in robots_group.children.values():
            if robot.team_id == self.id:
                yield robot
    
    def getstate(self)->Any:
        d = self.__dict__.copy()
        del d[ATTR_UPDATED]
        d["years"] = {str(num):year.__dict__.copy() for num, year in self.years.items()}
        d["socials"] = [social.__dict__.copy() for social in self.socials]
        return d

    def setstate(self, state:dict[str]):
        self.__init__(**state)
        super().setstate(state)


class RobotYear(extradata):
    """
    Data for a robot pertaining to one year.
    """

    def __init__(self, images:dict[str, list[str]]=None, comments:str="", **kwargs):
        self.images = images if isinstance(images, dict) else {} #angle_name -> [image path, ...]
        self.comments = comments
        super().__init__(**kwargs)

class Robot(MiscStructure):
    """
    Contains data on a robot.
    """

    @classmethod
    def create(cls, team_id:int, years:dict[int, RobotYear|dict[str]]|None=None, comments:str="", dt:datetime|None=None):
        """
        Creates a new Robot from the given team ID, year info, and comments.

        A custom `datetime` can be specified for generating the Robot's ID, but it is
        recommended that the current date and time is used.
        """
        return cls(id=database.generate_id(dt), team_id=team_id, years=years, comments=comments)

    def __init__(self, id:int, team_id:int, years:dict[int, RobotYear|dict[str]]|None=None, comments:str="", **kwargs):
        super().__init__(id, **kwargs)
        self.team_id = team_id
        self.years = {int(num): data if isinstance(data, RobotYear) else RobotYear(**data) for num, data in years.items()} if isinstance(years, dict) else {}
        self.comments = comments

    def get_team(self):
        """
        Get the Team with the stored `team_id`.
        """
        return teams_group.get(self.team_id)

    def getstate(self)->Any:
        d = self.__dict__.copy()
        del d[ATTR_UPDATED]
        d["years"] = {str(num):year.__dict__.copy() for num, year in self.years.items()}
        return d

    def setstate(self, state:dict[str]):
        self.__init__(**state)
        super().setstate(state)

hosts_group = JsonDirStructureGroup[Host](STRUCT_HOSTS_SCOPE, Host)
teams_group = JsonDirStructureGroup[Team](STRUCT_TEAMS_SCOPE, Team)
robots_group = JsonFileStructureGroup[Robot](STRUCT_ROBOTS_SCOPE, Robot) #DEBUG
