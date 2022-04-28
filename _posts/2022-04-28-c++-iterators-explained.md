---
title: "C++ iterators are actually really easy"
layout: post
---

So I was trying to build my own abstract data type for a project I'm making. I ended up scouring the
internet for short examples of how iterators work, and didn't find one.

So, Dear Reader, here's how you write an iterator:
```cpp
struct MyIterator {
   // Updates the iterator to point to the next element.
   MyIterator &operator++();
   // Returns the element at the current position.
   Element &operator*();
   // Returns whether two iterators' positions differ.
   bool operator!=(const Iterator &other);
};
```

And that's all there is to it.

For instance, if we wanted to write an iterator that counts upwards:
```cpp
struct Counter {
private:
   size_t count;

public:
   Counter &operator++() {
      ++count;
      return *this;
   }

   size_t &operator*() {
      return count;
   }

   bool operator!=(const Counter &other) {
      return count != other.count;
   }
};
```

Now, to use the iterator, we simply use our defined operators.
```cpp
auto iter = Counter(1);
std::printf("%zu\n", *iter); // 1
++iter;
std::printf("%zu\n", *iter); // 2
++iter;
std::printf("%zu\n", *iter); // 3
```

To be quite frankly honest, I really don't like the name "iterator". What it _really_ is is a
generalized pointer to a place in some (possibly infinite) sequence, so I think the name "cursor"
would be a better fit. But I digress.

Now, an iterator is not very useful if it doesn't have upper and lower bounds. This is why iterable
data types define `begin()` and `end()` functions - they define the bounds of an iterator.

Say we wanted to implement an iterable called `CountUp`, that - you guessed it - counts upwards.

We first define the `CountUp` type itself:
```cpp
struct CountUp {
   size_t min, max;
};
```
Then, we define the "cursor" of our iterable, ie. the iterator.
```cpp
struct CountUp {
   // -- snip --

   struct Iterator {
      size_t position;

      Iterator &operator++() {
         ++position;
         return *this;
      }

      size_t &operator*() {
         return position;
      }

      bool operator!=(const Iterator &other) {
         return position != other.position;
      }
   };
};
```
Lastly, we define `begin()` and `end()` that specify the bounds of our `CountUp` range.
```cpp
struct CountUp {
   // -- snip --

   Iterator begin() {
      return { min };
   }

   Iterator end() {
      return { max };
   }
};
```

Defining the bounds of an iterable allows us to use it with range-based `for` loops.
```cpp
for (size_t i : CountUp{1, 10}) {
   std::printf("%zu\n", i);
}
```
In fact, a range based `for` loop desugars to a regular C-style `for` loop, like so:
```cpp
auto iterable = CountUp{1, 10};
// Note the usage of != and ++, which are likely to be overloaded.
for (auto iterator = iterable.begin(); iterator != iterable.end(); ++iterator) {
   size_t i = *iterator;
}
```

Here's the full code listing:
```cpp
#include <cstddef>
#include <cstdio>

struct CountUp {
   size_t min, max;

   struct Iterator {
      size_t current;

      Iterator &operator++() {
         ++current;
         return *this;
      }

      size_t &operator*() {
         return current;
      }

      bool operator!=(const Iterator &other) {
         return current != other.current;
      }
   };

   Iterator begin() {
      return { min };
   }

   Iterator end() {
      return { max };
   }
};

int main(void) {
   for (size_t i : CountUp{1, 10}) {
     std::printf("%zu\n", i);
   }
   return 0;
}
```

And that's all there really is to the basics of iterators. They're nothing complicated, in fact
they're just a bunch of overloaded operators.

Personally, coming from Rust, I had trouble understanding them, because I expected that _an iterator_
does all the iteration in a range-based `for`. But in C++, it's different: iterators and iterables
always come in pairs.

Of course I'm skipping over all the other parts of the iterator hierarchy, simply because it's
outside the scope of this post. But just know that various concepts defined in the standard
basically add more operator overloads on top of the basic iterator interface.

