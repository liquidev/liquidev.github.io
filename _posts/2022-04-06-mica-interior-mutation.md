---
title: "Solving the mutability of consts in popular scripting languages"
layout: post
---

JavaScript, Python, Lua, Ruby, … all have an annoying problem. Constants (or immutable variables)
can actually be mutated!

…Well, not exactly. You can't _assign new values_ to constants. That's the whole point. But I
believe that guarantee is not strong enough. Let's have a look.

# How things are today

Out of the four languages I listed, I'm familiar with the first three, and have read a bit about
Ruby (but haven't coded anything meaningful in it). Let's see how they fare.

First up, we have JavaScript with its `const`.
```js
const i = 0
i = 2        // Uncaught TypeError: invalid assignment to const 'i'
```
But it does not guarantee immutability of the _value_ that is inside the variable.
```js
const b = { i: 0 }
b.i = 2  // works
```

Then there's Lua, which, since version 5.4, has a `<const>` annotation for local variables. Rather
ugly syntactically, but let's see how it works.
```lua
local i <const> = 1
i = 2  -- error: attempt to assign to const variable 'i'
```
Seems fine on the surface, but… there's a problem.
```lua
local b <const> = { i = 1 }
b.i = 2  -- works
```
Same thing as JavaScript. It's only surface-level immutability, and very inconvenient to use on
top of that.

Ruby has constants, which are simply variables that start with an uppercase letter. They have some
really strange scoping rules though – you cannot define a constant in a method, it has to be defined
in a class.
```ruby
HELLO = "Hello!"  # works
def hi
   HI = "Hi!"     # error: dynamic constant assignment (SyntaxError)
end
```
But even then, it shares the same problem as JavaScript and Lua.
```ruby
# I'm using a hash here since I don't know if there's an easier way of creating
# an object instance than through declaring a class with a constructor.
BOX = { :i => 1 }
def stuff
   BOX[:i] = 2
end
stuff  # works
```

Python has no form of immutable variables at all.

# A new contender

[Mica](https://github.com/mica-lang/mica) is a dynamically typed scripting language I've been
developing over the past month or so, purely for fun. One thing I've been quite troubled with is how
to achieve a sensible system for immutability. And I mean _immutability_. As in _deep_. If you give
someone the permission to read, they _must_ uphold that invariant on all layers.

# Variables

Currently, all variables in Mica are mutable. Assigning to a variable always assigns to the
outermost one, which might be problematic in large scripts with many variables declared.
So my idea was to introduce a new keyword: `mut`, which can be followed by an identifier to state
mutability. This forms a _`mut` expression_, eg. `mut x`.

With `mut` expressions, all assignments become immutable by default, shadowing previous variables.
For example:
```mica
x = 1
do
   x = 2
   assert(x == 2)
end
# Old x is not overwritten by the assignment in the `do` block.
assert(x == 1)
```
A `mut` expression can be used as the left-hand side of an assignment, to create a mutable variable.
Assigning to a mutable variable with `a = b` always overwrites its value, unless `a` itself is a
`mut` expression, in which case the variable is shadowed. Projects could employ naming conventions
for "dangerous" patterns like mutable variables at the script's top level.
```mica
func factorial(n)
   mut i = 1
   mut x = 1
   while i <= n do
      x = x * i
      i = i + 1
   end
   n
end

# This could cause you a problem if you're not careful, so it's prefixed with g_.
mut g_variable = 1
func mutate_g_variable()
   g_variable = 2
end
mutate_g_variable()
assert(g_variable == 2)
```

This is all fine and dandy until you realize that this doesn't prevent you from mutating _structs_
inside. A variable's mutability only determines whether you can assign to that variable, but not
whether you can mutate the value inside.
```mica
impl struct Cell
   func new(value) constructor
      @value = value
   end

   func get() @value end
   func set(x) @value = x end
end

# Note: c is immutable!
c = Cell.new(1)
assert(c.get == 1)
c.set(2)
assert(c.get == 2)  # Oh no, mutation without `mut`!
```

# Struct fields

Let's extend our effort from merely having (im)mutable variables, to also having immutable fields.

If you're not familiar with Mica, here's a quick overview of how struct fields work:
- Each user-defined struct can have fields.
- Fields are declared in the _first_ constructor by simply assigning to them.
- Assigning to or referencing fields that were not declared in the first constructor is an error.
- Each constructor after the first one must assign to the same fields as the first one.

So now, let's introduce immutability to fields. Fields work very much like variables, so we can
extend the `mut` expression syntax to also work for fields: `mut @x`.

Now, let's make `mut` expressions that reference fields also a valid left-hand side of assignment.
However, assigning to a `mut` field expression can only be done in the first constructor, which
is the one that defines mutability. You might think to yourself, *"gee, but that makes other
constructors asymmetrical with the first one!"*, and you're right! But I think this is the right
decision, because repeating yourself becomes a nightmare after you come back to refactor some code.

Say you're writing a multiplayer game. So you have a `Player` struct, and it has a `speed` field
that you preemptively make mutable because you may wanna add status effects later that alter the
player's speed.
Because this is a multiplayer game, you end up with two constructors: `new_local`, and `new_remote`,
one for the player instance that's controlled locally, and the other for instances controlled by
players from the network.
After iterating a while on your concept, you realize that you never needed the `speed` field to be
mutable, but now you have to remove the `mut` in _two_ constructors instead of one! Fun, right!?

So let's not have that. First constructor defines mutability, period.

Anyways, the syntax would then be this:
```mica
impl struct Player
   func new_local() constructor
      # We want the position to be mutable.
      mut @x = 0
      mut @y = 0
      # But the speed, not so much.
      @speed = 10
   end

   func new_remote() constructor
      # This is the second constructor, so mutability of fields is inherited
      # from the first one.
      remote_pos = server.request_player_position()
      @x = remote_pos.x
      @y = remote_pos.y
      @speed = 10
   end
end
```

Afterwards, the `@x` and `@y` fields we declared can be mutated as usual, but `@speed` cannot:
```mica
impl struct Player
   # -- snip --

   func controls()
      if input.key_down("a") do
         @x = @x - @speed
      end
      if input.key_down("d") do
         @x = @x + @speed
      end
      if input.key_down("w") do
         @y = @y - @speed
      end
      if input.key_down("s") do
         @y = @y + @speed
      end
   end
end
```

# Structs

_Well, what about that `Cell` example from before? It's still valid under this model_, I hear you
say. Worry not, because I have a solution™.

The solution to this is to annotate all instance methods that can mutate fields. Say, with a `mut`
keyword after `func`:
```mica
impl struct Vector
   # -- snip --

   func x() @x end
   func y() @y end

   func mut set_x(x)
      @x = x
   end

   func mut set_y(y)
      @y = y
   end
end
```
But the annotation itself is pretty useless if it's not enforced. So we now alter the mere act of
referencing variables, such that it _decays the copied value as immutable_. From the
implementation's point of view, it's essentially just a bit flip a bit to say,
*Hey, this reference to the object is now immutable. Please don't ruin what's inside. kthx ^^*

Note that this only matters for some types of objects; namely, ones that have interior mutability
on the Rust side, such as lists and structs. For everything else we can continue as normal.
Now ask me _which_ bit this sets in the value representation, and uhh… I don't know.
NaN-boxed values are pretty tight on space. What's important is that, every single read of a
variable containing an object with a mutable interior produces a immutable version of that original
value.

By the way do note that everything is pass-by-value in Mica. It's just that strings, functions,
lists, structs, and user data, are all just pointers to a heap allocation inside.
So if you copy them, you're essentially creating a new reference to the value behind the pointer.
Decaying the mutability prevents you from writing to anything behind that reference.

_You may look, but you shall not touch._

Of course if _every_ single attempt to reference a variable would result in getting an immutable
reference, that would be pretty useless, because we wouldn't be able to mutate the object inside,
at all, _ever_. This is where `mut` expressions come in again. To copy a value out of a variable
without immediately decaying it, we can use the `mut` expression. For instance:
```mica
mut c = Cell.new(1)
# Create a second mutable reference to the same cell.
mut d = mut c
```
`mut` in non-left-hand-side-of-assignment position can only be used on variables and fields that are
mutable, and the reference inside must not be immutable.

With this syntax, we can now enforce that `mut`-annotated functions can only be called on mutable
values. But there's a problem. See, now if we want to call a function that mutates a value inside of
a variable, we need to go through _this_ ceremony:
```mica
mut c = Cell.new(1)
mut c.set(1)
```
_Now I dunno about you, but I can't say I'm a fan._

Therefore we can also add a rule saying that if the left-hand side of a dot is a mutable variable,
it automatically desugars to a `mut` expression. With that, we can keep our sanity and simply
use the normal syntax for calls:
```mica
mut c = Cell.new(1)
c.set(1)
```

# Conclusion

Aaaand, that's it! Interior mutability is solved. To be able to mutate an object you now have to
have an explicit permission from its owner, or from whoever else holds a mutable reference to said
object.

Now onto implementing all of this…
