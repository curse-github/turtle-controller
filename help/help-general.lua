--variables
    --var0 = 0
    --var1 = "1"
    --var2 = false

    --var0, var1, var2 = 0, "1", false
--tables
    --table = {one = "2", two = "thirteen", three = "4", four = "five", five = "6"}
    --write(table.two) returns "thirteen0"
    --write(table.four) returns "five0"
    --write(table.one) returns "20"
    --table.six = "7"

--string operations
    --"1".."2".."3" = "123"
    --string = "var is "..var0 --would print "var is 0"
--if statements
    --if var1 == "1" and not var0 < 1 or not var2 == true then
        --code
    --else
        --more code
    --end

    --if var1 == "1" and var0 < 1 or var2 ~= true then --code else --more code end
--functions
    --function funcName(str)
        --write(str + " \n")
    --end

    --funcName = function(num)
        --return num / 3
    --end
    --note: both ways make the same thing. personally i perfer the first one

    --newFunc = funcName --makes a new function that does the same thing

    --funcName("hello")
--loops
    --for
        --for var=start, end, interval do
            --code
        --end
        --for i = 0, 10 do
            --write(i)
        --end
        --if you leave out interval it will default to 1
        --table = {1,2,3,4,5,6,7,8,9,10}
        --for i = 0, #table do
            --write(table[i])
        --end
        --they both print 012345678910
        
    --while
        --while condition do
            --code
        --end
        --i = 0
        --while i < 11 do
            --write(i)
            --i += 1
        --end
        --prints 012345678910