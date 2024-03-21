from . import imports_for_testing
imports_for_testing()

import accounts
import config
import database
import comp_tables
import os
from sqlalchemy import Boolean, Column, Integer

CLEANUP = True


class CompData(comp_tables.Profile):

    __tablename__ = "profile"

    scores = Column(Integer, nullable=False)
    is_win = Column(Boolean, nullable=False)

    def __init__(self, id:int, match_id:int, account_id:int, robot:str, scores:int, is_win:bool):
        super().__init__(id, match_id, account_id, robot)
        self.scores = scores
        self.is_win = is_win


def main():

    #create tables

    accounts.Account.create_table()
    comp_tables.Match.create_table()
    CompData.create_table()

    #open sessions

    database.shared_db.create_session()
    database.comp_db.create_session()


    #do stuff ...

    database.comp_db.session.add(CompData(database.generate_id(), database.generate_id(), database.generate_id(), "A", 10, True))


    #commit remaining changes

    database.shared_db.session.commit()
    database.comp_db.session.commit()

    #close sessions

    database.shared_db.close_session()
    database.comp_db.close_session()


if __name__ == "__main__":
    try:
        main()
    finally:
        #close dbs
        database.shared_db.engine.dispose()
        database.comp_db.engine.dispose()

        #cleanup
        if CLEANUP:
            os.remove(config.DB_SHARED_URI.split("///")[-1])
            os.remove(config.DB_COMP_URI.split("///")[-1])


    