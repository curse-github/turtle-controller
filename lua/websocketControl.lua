os.loadAPI("json.lua");
function prepare(val)
    if type(val) == "table" then
        returnVal = json.encode(val)
        returnVal = string.gsub(returnVal,":","|")
        returnVal = string.gsub(returnVal,"\n","")
        returnVal = string.gsub(returnVal," ","")
        returnVal = string.gsub(returnVal,"\"","\\\"")
        return returnVal
    else  return tostring(val) end
end

function blink()
    while true do
        shell.run("clear")
        write("CraftOS 1.8\n> _\n")
        sleep(0.5)
        shell.run("clear")
        write("CraftOS 1.8\n>")
        sleep(0.5)
    end
end
function websocket()
    ws, err = http.websocket("ws://mc.campbellsimpson.com:58742")
    if ws ~= false then
        ws.send("{\"type\":\"connection\",\"connection\":\"turtle\"}")
        while true do
            message = ws.receive()
            obj = json.decode(message.."\n")
            if obj.type == "lua" then
                output = {}
                func, err = loadstring("output[0], output[1], output[2] = "..obj.cmd)
                setfenv(func, getfenv())
                func()
                ws.send("{\"type\":\"return\", \"id\":\""..obj.id.."\", \"return\":[\""..prepare(output[0]).."\", \""..prepare(output[1]).."\", \""..prepare(output[2]).."\"]}")
            elseif obj.type == "ping" then
                ws.send("{\"type\":\"pong\", \"id\":\""..obj.id.."\"}")
            else
                ws.send("{\"type\":\"reply\", \"id\":\""..obj.id.."\"}")
            end
        end
    else write(err.."\n") end
end

parallel.waitForAny(blink,websocket)