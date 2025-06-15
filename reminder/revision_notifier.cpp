#include <iostream>
#include <fstream>
#include <string>
#include <ctime>
#include <cstdlib>

using namespace std;

pair<string, string> parse_line(const string& line) 
{
    size_t comma_pos = line.find(',');
    string date, problem_info;

    if(comma_pos != string::npos) 
    {
        date = line.substr(0, comma_pos);
        problem_info = line.substr(comma_pos + 1);
    }
    return {date, problem_info};
}


void send_revision_notifications(const string& revision_date, const string& today_date) 
{
    fstream problem_file("../data/problems.csv", ios::in | ios::out);

    if(!problem_file.is_open()) 
    {
        cout << "Unable to open file" << endl;
        return;
    }

    string line;
    streampos offset = 0;
    while(getline(problem_file, line)) 
    {
        auto [date, problem_name] = parse_line(line);
        streampos line_start = offset;
    
        if(date == revision_date) 
        {
            string notify_command = 
                "DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus "
                "notify-send 'LeetCode Reminder' 'Problem " + problem_name + ": you have to solve today!'";
            system(notify_command.c_str());
            problem_file.seekp(line_start);
            problem_file.write(today_date.c_str(),10);
        }
        offset = problem_file.tellg();
        if(offset == -1) break; 
    }
    problem_file.close();
}

string format_date(time_t raw_time) 
{
    char buffer[11];
    tm* time_info = localtime(&raw_time);
    strftime(buffer, sizeof(buffer), "%d-%m-%Y", time_info);
    return string(buffer);
}

int main() 
{
    time_t current_time = time(nullptr);
    string today_date = format_date(current_time);

    time_t one_week_ago = current_time - (7 * 24 * 60 * 60);
    string revision_date = format_date(one_week_ago);

    send_revision_notifications(revision_date,today_date);

    return 0;
}
