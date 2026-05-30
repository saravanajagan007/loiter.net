import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, MousePointer2, Share2, MessageSquare, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const metrics = [
    { title: "Total Reach", value: "12,482", change: "+14%", icon: TrendingUp },
    { title: "Engagement Rate", value: "4.2%", change: "+0.8%", icon: MousePointer2 },
    { title: "New Followers", value: "128", change: "+22%", icon: Users },
    { title: "Impressions", value: "45.2K", change: "+5%", icon: BarChart3 },
  ];

  const topPosts = [
    { 
      id: 1, 
      content: "The future of AI is not just about automation, it's about augmentation. 🚀 #AI #Tech", 
      platform: "X",
      likes: 245,
      retweets: 42,
      replies: 18,
    },
    { 
      id: 2, 
      content: "Why most SaaS companies fail in the first 12 months. A thread 🧵", 
      platform: "X",
      likes: 182,
      retweets: 38,
      replies: 12,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Track the performance of your automated social content.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-green-500 font-medium">{metric.change} from last month</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Daily engagement across all platforms.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-end gap-2 pt-4">
              {[40, 60, 45, 90, 65, 80, 50, 70, 85, 60, 75, 95].map((h, i) => (
                <div 
                  key={i} 
                  className="bg-primary/20 hover:bg-primary/40 transition-colors rounded-t w-full"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-4 text-xs text-muted-foreground px-1">
              <span>May 1</span>
              <span>May 7</span>
              <span>May 14</span>
              <span>May 21</span>
              <span>May 28</span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Performing Posts</CardTitle>
            <CardDescription>Based on total engagement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPosts.map((post) => (
              <div key={post.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">{post.platform}</Badge>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {post.likes}</span>
                    <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> {post.retweets}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {post.replies}</span>
                  </div>
                </div>
                <p className="text-xs line-clamp-2 italic text-muted-foreground">&quot;{post.content}&quot;</p>
              </div>
            ))}
            <div className="pt-2">
              <p className="text-[10px] text-center text-muted-foreground italic">
                Data refreshes every 24 hours.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
