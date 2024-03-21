import accounts
import clips
import database
from datetime import datetime
from enum import Enum
import sqlalchemy
from sqlalchemy import Column, DateTime, Integer, String
import sqlalchemy.orm

ROBOT_DESIGNATION_LENGTH = 2 #letter between A and ZZ (676 possible values)

MATCH_TABLENAME = "matches"

class MatchType(Enum):
    """
    Different types of matches.
    """
    QUAL = 0 #qualifier matches
    ELIM = 1 #elimination matches
    SKILLS_DRIVE = 2 #driving skills
    SKILLS_AUTO = 3 #autonomous coding skills

class MatchTypeDecorator(sqlalchemy.TypeDecorator):
    """
    Decorator for match type database columns. Converts between `MatchType` and `int`.
    """
    impl = Integer
    cache_ok = True

    def process_bind_param(self, value:MatchType, dialect):
        """
        Converts a `MatchType` to an `int`.
        """
        return value.value if isinstance(value, MatchType) else None
    
    def process_result_value(self, value:int, dialect):
        """
        Converts an `int` to a `MatchType`.
        """
        return MatchType(value) if isinstance(value, int) else None



class Match(database.comp_db.Base):
    """
    Stores match metadata.
    """

    __tablename__ = MATCH_TABLENAME

    id = Column(Integer, primary_key=True)
    host_id = Column(Integer, nullable=False) #links to misc data "Hosts"
    date = Column(DateTime, nullable=False)
    type = Column(MatchTypeDecorator, nullable=False)
    number = Column(Integer, nullable=False)

    @classmethod
    def create_table(cls, engine=database.comp_db.engine):
        """
        Adds the table's metadata to the database.
        """
        database.create_table(cls.__table__, engine)

    @classmethod
    def drop_table(cls, engine=database.comp_db.engine):
        """
        Drops the table's metadata from the database.
        """
        database.drop_table(cls.__table__, engine)

    def __init__(self, id:int, host_id:int, date:datetime, type:MatchType, number:int):
        self.id = id
        self.host_id = host_id
        self.date = date
        self.type = type
        self.number = number

    def get_clip_path(self, comp_name:str, file_format:str):
        """
        Construct a clip path using data from this match, plus a competition name and file format.

        It should be noted that clip paths contructed with this method are not guaranteed to exist.
        """
        return clips.construct_path(comp_name, self.date, self.type, self.number, file_format)
    

class Profile(database.comp_db.Base):
    """
    Abstract class for Profiles, contains the columns for storing Profile metadata.

    Profiles in general store a robot's performance for a match.
    """

    __abstract__ = True

    @classmethod
    def create_table(cls, engine=database.comp_db.engine):
        """
        Adds the table's metadata to the database.
        """
        database.create_table(cls.__table__, engine)

    @classmethod
    def drop_table(cls, engine=database.comp_db.engine):
        """
        Drops the table's metadata from the database.
        """
        database.drop_table(cls.__table__, engine)

    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, nullable=False)
    account_id = Column(Integer, nullable=True) #TODO consider making nullable depending on if accounts are enabled
    robot = Column(String(ROBOT_DESIGNATION_LENGTH), nullable=False)

    def __init__(self, id:int, match_id:int, account_id:int|None, robot:str):
        self.id = id
        self.match_id = match_id
        self.account_id = account_id
        self.robot = robot

    def get_account(self)->accounts.Account|None:
        """
        Get the Account with the stored `account_id`.
        """
        return None if self.account_id is None else database.shared_db.session.query(accounts.Account).filter(accounts.Account.id == self.account_id).first()

    def get_match(self)->Match|None:
        """
        Get the Match with the stored `match_id`.
        """
        return database.comp_db.session.query(Match).filter(Match.id == self.match_id).first()
