from . import imports_for_testing
imports_for_testing()

import accounts
import config
import database
from datetime import datetime
import comp_tables
import misc_structs
import os
import random
import shutil
from sqlalchemy import Boolean, Column, Integer

CLEANUP = True

class CompData(comp_tables.Profile):

    __tablename__ = "profile"

    scores = Column(Integer, nullable=False)
    is_win = Column(Boolean, nullable=False)

    @classmethod
    def create(cls, match_id:int, account_id:int|None, robot_id:int, scores:int, is_win:bool, comments:str, dt:datetime|None=None):
        return cls(id=database.generate_id(dt), match_id=match_id, account_id=account_id,
                   robot_id=robot_id, scores=scores, is_win=is_win, comments=comments)

    def __init__(self, id:int, match_id:int, account_id:int, robot_id:str, scores:int, is_win:bool, comments:str):
        super().__init__(id, match_id, account_id, robot_id, comments)
        self.scores = scores
        self.is_win = is_win


#wrote this cause i was freaking out that it was taking so long to generate all
#the data. silly little me forgot that it takes a second (literally) to hash the
#passwords for the scouter accounts :P
class timethis:
    def __init__(self, action:str):
        self.action = action
        self.begin:datetime = None
        self.end:datetime = None

    def start(self):
        print("starting:", self.action)
        self.begin = datetime.now()
    
    def stop(self):
        self.end = datetime.now()
        print(f"stopping: {self.action}\ttime:", (self.end-self.begin).total_seconds())

def main():

    #create tables

    accounts.Account.create_table()
    comp_tables.Match.create_table()
    CompData.create_table()

    #open sessions

    misc_structs.hosts_group.open()
    misc_structs.teams_group.open()
    misc_structs.robots_group.open()

    database.shared_db.create_session()
    database.comp_db.create_session()


    #do stuff ...

    #if theres already data generated
    if misc_structs.hosts_group:
        print("accounts:", database.shared_db.session.query(accounts.Account).count())
        print("match:", database.comp_db.session.query(comp_tables.Match).count())
        print("profiles:", database.comp_db.session.query(CompData).count())
        print("hosts:", sum(1 for _ in misc_structs.hosts_group))
        print("teams:", sum(1 for _ in misc_structs.teams_group))
        print("robots:", sum(1 for _ in misc_structs.robots_group))
    else:

        #timers

        whole_thing = timethis("whole thing")
        host_time = timethis("host")
        teams_time = timethis("teams")
        scouters_time = timethis("scouters")
        profiles_time = timethis("profiles")
        commit_time = timethis("commit")


        whole_thing.start()

        #generate new data
        
        host_time.start()

        team_host = misc_structs.Team.create(
            "Team Host",
            {2023: misc_structs.TeamYear(20, 5, "wicked", "tricked", "offense", "chill", "fast", "none", "awesomesauce", new_value="test"),
            2024: misc_structs.TeamYear(19, 1, "wicked", "tricked", "offense", "chill", "fast", "none", "awesomesauce", new_value="test").__dict__.copy()},
            [misc_structs.TeamSocial("service1", "username", 12345, new_value="test"), misc_structs.TeamSocial("service2", "username", 12345, new_value="test").__dict__.copy()]
        )

        host_event = misc_structs.HostEvent("event location", 2024, "2025-3-9", "large", 16, 2, 4, 6, 3, 3, 3, "skills fields were also used for practice", new_value="test")
        host = misc_structs.Host.create(team_host.id, [host_event], "comment")

        misc_structs.hosts_group.add(host)

        host_time.stop()
        teams_time.start()

        teams = [misc_structs.Team.create(f"Team {n}", {2023:{}, 2024:{}}) for n in range(1, 5)] #4 teams numberer 1-4

        for team in teams:
            misc_structs.teams_group.add(team)
            for _ in range(2):
                robot = misc_structs.Robot.create(team.id, {2024: misc_structs.RobotYear(new_value="test")}, "this comment is so comment pilled")
                misc_structs.robots_group.add(robot)

        teams_time.stop()
        scouters_time.start()

        scouters = []
        for n in range(1, 5):
            scouter = accounts.Account.create(f"Scouter {n}", f"email{n}@domain.name", f"epicP@asw0rd{n}") #NOTE: takes a while because the passwords need to be hashed
            scouters.append(scouter)
            database.shared_db.session.add(scouter)

        scouters_time.stop()
        profiles_time.start()

        qual_1 = comp_tables.Match.create(host.id, datetime.strptime(host_event.date, "%Y-%d-%m"), comp_tables.MatchType.QUAL, 1)
        qual_2 = comp_tables.Match.create(host.id, datetime.strptime(host_event.date, "%Y-%d-%m"), comp_tables.MatchType.QUAL, 2)
        qual_3 = comp_tables.Match.create(host.id, datetime.strptime(host_event.date, "%Y-%d-%m"), comp_tables.MatchType.QUAL, 3)

        qual_matchups = (0, 3), (1, 2), (0, 2) #assuming teams 1 and 3 win their first matchups
        qual_matches = qual_1, qual_2, qual_3
        for i, m in enumerate(qual_matches):
            database.comp_db.session.add(m)
            win = random.randint(0, 1)
            for j, team in enumerate((teams[qual_matchups[i][0]], teams[qual_matchups[i][1]])):
                win = not win
                for offset, robot in enumerate(misc_structs.robots_group.filter(team_id=team.id)):
                    database.comp_db.session.add(CompData.create(m.id, scouters[j*2+offset].id, robot.id, random.randint(0, 10), win, f"comment {i} {j} {offset}"))

        profiles_time.stop()
        
        #commit remaining changes

        commit_time.start()

        misc_structs.hosts_group.commit()
        misc_structs.teams_group.commit()
        misc_structs.robots_group.commit()

        database.shared_db.session.commit()
        database.comp_db.session.commit()

        commit_time.stop()

        whole_thing.stop()

    input("Enter to continue")

    #close sessions

    misc_structs.hosts_group.close()
    misc_structs.teams_group.close()
    misc_structs.robots_group.close()

    database.shared_db.close_session()
    database.comp_db.close_session()


if __name__ == "__main__":
    try:
        main()
    except:
        no_errors = False
        raise
    else:
        no_errors = True
    finally:
        #close dbs
        database.shared_db.engine.dispose()
        database.comp_db.engine.dispose()

        #cleanup
        if no_errors and CLEANUP:
            shutil.rmtree(config.STRUCT_HOSTS_SCOPE)
            shutil.rmtree(config.STRUCT_TEAMS_SCOPE)
            os.remove(config.STRUCT_ROBOTS_SCOPE)
            os.remove(config.DB_SHARED_URI.split("///")[-1])
            os.remove(config.DB_COMP_URI.split("///")[-1])
