'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

interface CompactIndexerDashboardProps {
  trackerHeight?: number;
  latestHeight?: number;
  percentIndexed?: string | null;
  isLoading: boolean;
  error: Error | null; // Changed from 'any' to a more specific type
}

export function CompactIndexerDashboard({
  trackerHeight,
  latestHeight,
  percentIndexed,
  isLoading,
  error
}: CompactIndexerDashboardProps) {
  if (isLoading) {
    return <IndexerSkeleton />;
  }

  if (error) {
    return <ErrorMessage />;
  }

  return (
    <Card className="w-full"> 
      <CardContent className="p-4">
        <div className="flex items-center justify-between space-x-2 text-sm">
          <div className="font-medium">Indexer Status:</div>
          <div className="flex items-center space-x-2">
            <StatusItem label="Tracker" value={trackerHeight?.toString() || '-'} />
            <StatusItem label="Latest" value={latestHeight?.toString() || '-'} />
            <div className="flex items-center space-x-2">
              <span className="font-medium">Indexed:</span>
              <span>{percentIndexed || '0'}%</span>
            </div>
          </div>
        </div>
        <Progress value={parseFloat(percentIndexed || '0')} className="h-1 mt-1" />
      </CardContent>
    </Card>
  )
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center space-x-1">
      <span className="text-muted-foreground">{label}:</span>
      <span>{value}</span>
    </div>
  )
}

function IndexerSkeleton() {
  return (
    <Card className="w-full"> 
      <CardContent className="p-2">
        <div className="flex items-center justify-between space-x-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-1 w-full mt-1" />
      </CardContent>
    </Card>
  )
}

function ErrorMessage() {
  return (
    <Card className="w-full"> 
      <CardContent className="p-2">
        <div className="text-sm text-red-500">Error loading indexer status. Please try again later.</div>
      </CardContent>
    </Card>
  )
}