from dataclasses import dataclass
# import io
# import json
import sqlalchemy
import sqlalchemy.orm
from typing import Any, Callable, IO

class DB:
    """
    Class for working with sqlalchemy databases.
    """

    def __init__(self, engine:sqlalchemy.Engine|str|sqlalchemy.engine.URL, metadata:sqlalchemy.MetaData|None=None, autoflush:bool=True, expire_on_commit:bool=True):
        self.engine = sqlalchemy.create_engine(url=engine) if isinstance(engine, (str, sqlalchemy.engine.URL)) else engine
        self.metadata = metadata if isinstance(metadata, sqlalchemy.MetaData) else sqlalchemy.MetaData()
        self.Base = sqlalchemy.orm.declarative_base(metadata=self.metadata) #TODO is this needed? will Base->Profile or Profile->Base?
        self.session_maker = sqlalchemy.orm.sessionmaker(bind=self.engine, autoflush=autoflush, expire_on_commit=expire_on_commit)
        self.session:sqlalchemy.orm.Session|None = None

    def create_session(self):
        """Create a session, if one has not already been created. Returns the session."""
        if self.session is None:
            self.session = self.session_maker()
        return self.session
    
    def close_session(self):
        """Close the current session, if one is open."""
        if self.session is not None:
            self.session.close()
            self.session = None

@dataclass(slots=True)
class SubmissionConversionContext:
    """
    Context when converting from submission data to database data.
    """
    column:"ProfileColumn"
    profile:"Profile"
    sql_column:sqlalchemy.Column
    session:sqlalchemy.orm.Session
    sumbission_data:dict[str]
    selected:Any|None


class ProfileColumn:
    """
    Contains information on a column in a profile.
    """

    default_convert_submission:Callable[[SubmissionConversionContext], Any] = lambda ctx: ctx.selected

    def __init__(self, column_name:str, submission_name:str, convert_submission:Callable[[SubmissionConversionContext], Any], strict:bool=False, weight:float|None=None):
        self.column_name = column_name
        self.submission_name = submission_name
        self.convert_submission = convert_submission
        self.strict = strict
        self.weight = weight

class Profile:
    """
    Stores data used to map a submission to the data which gets stored in the database.
    """

    # @classmethod
    # def from_json(cls, name:str, data:dict[str, dict[str]]|str|IO[str|bytes]):
    #     """Read Profile from JSON data."""
    #     if isinstance(data, io.IOBase):
    #         data = json.load(data)
    #     elif isinstance(data, str):
    #         data = json.loads(data)
    #     if not isinstance(data, dict):
    #         raise TypeError(f"Expected data to be JSON file, JSON string, or parsed JSON data (dict), got: {type(data).__name__}")
    #     columns = []
    #     for column_name, profile_data in data.items():
    #         columns.append(ProfileColumn(
    #             column_name,
    #             submission_name=profile_data["submission_name"],
    #             convert_submission=_load_profile_column_function(profile_data.get("convert_submission")) or ProfileColumn.default_convert_submission,
    #             strict=profile_data.get("strict", False),
    #             weight=profile_data.get("wieght")
    #         ))
    #     return cls(name=name, *columns)

    def __init__(self, name:str, *columns:ProfileColumn):
        self.name = name
        self.columns = columns

    def convert_submission(self, data:dict[str], Base:sqlalchemy.orm.decl_api.DeclarativeMeta, session:sqlalchemy.orm.Session):
        """
        Convert the given submission (in the form of dict[str, Any]) to a row in the
        table described by the provided sqlalchemy Declarative Base subclass.
        """
        instance = Base.__new__(Base)
        for column in self.columns:
            sql_column:sqlalchemy.Column = getattr(Base, column.column_name)
            if column.submission_name in data:
                value = column.convert_submission(SubmissionConversionContext(column, self, sql_column, session, data, data[column.submission_name]))
                setattr(instance, column.column_name, value)
            elif column.strict:
                raise ValueError(f"Submission is missing key \"{column.submission_name}\".")
            elif sql_column.default is None:
                setattr(instance, column.column_name, None)
        return instance
    
    # def to_json(self)->dict[str, dict[str]]:
    #     """Convert Profile into JSON data."""
    #     data = {}
    #     for column in self.columns:
    #         data[column.column_name] = {
    #             "submission_name": column.submission_name,
    #             "convert_submission": getattr(column.convert_submission, "__source", None),
    #             "strict":column.strict,
    #             "weight":column.weight
    #         }
    #     return data

# def _load_profile_column_function(source:Callable[[SubmissionConversionContext], Any]|str|None, func_name="convert_submission"):
#     if source is None:
#         return None
#     elif callable(source):
#         return source
#     g = globals()
#     exec(source, g)
#     f = g[func_name]
#     f.__source = source
#     return g[func_name]
