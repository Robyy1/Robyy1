using System;
using System.Diagnostics;

class Program
{
    static void Main()
    {
        Stopwatch sw = Stopwatch.StartNew();
        long n = 2000000000;
        
        long sum = (n * (n + 1)) / 2;

        sw.Stop();
        Console.WriteLine($"Sum: {sum} | Time: {sw.Elapsed.TotalSeconds}s");
    }
}