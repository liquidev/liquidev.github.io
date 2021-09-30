---
layout: post
title: "Hello, world!"
---

Testing, testing.

*ahem*

Everything seems to be in order.

---

So, uh, I don't really have anything interesting to write about yet so here's a Mandelbrot fractal in Lua. This was golfed by me with some additional improvements from my friend, [Zevv](https://github.com/Zevv). Enjoy!

```lua
w=io.write for j=0,24 do x,y=-2,j/8-1.5 for i=0,80 do a,b,n=x,y,0 while n<9 and
a*a+b*b<6 do a,b,n=a*a-b*b+x,2*a*b+y,n+1 end w((".,:;=$%# "):sub(n,n))x=x+.0375
end w"\n"end
```
