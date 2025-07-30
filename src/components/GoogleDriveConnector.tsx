import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Upload, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface GoogleDriveConnectorProps {
  onFolderSelected: (folderId: string, folderName: string) => void;
  isConnected: boolean;
}

export const GoogleDriveConnector = ({ onFolderSelected, isConnected }: GoogleDriveConnectorProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [accessToken, setAccessToken] = useState<string>("");
  const [folderUrl, setFolderUrl] = useState<string>("");
  const [isTokenValid, setIsTokenValid] = useState<boolean>(false);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("gdrive_token");

    if (token) {
      // Kiểm tra token có hợp lệ không
      fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error("Invalid token");
          return res.json();
        })
        .then((data) => {
          setIsTokenValid(true);
          setAccessToken(token);
          toast("Connected to Google Drive", {
            description: `Welcome ${data.user.displayName}`,
          });
        })
        .catch(() => {
          setIsTokenValid(false);
          localStorage.removeItem("gdrive_token");
          toast("Google Drive token expired", {
            description: "Please enter a new access token",
          });
        });
    }
  }, []);


  const handleConnect = async () => {
    if (!accessToken.trim()) {
      toast("Please enter your Google Drive access token");
      return;
    }

    setIsConnecting(true);
    try {
      // Test the connection by fetching user info
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid access token');
      }

      const data = await response.json();
      localStorage.setItem('gdrive_token', accessToken);
      setIsTokenValid(true);
      
      toast("Connected to Google Drive successfully!", {
        description: `Welcome ${data.user.displayName}`
      });
    } catch (error) {
      setIsTokenValid(false);
      localStorage.removeItem('gdrive_token');
      toast("Failed to connect to Google Drive", {
        description: "Please check your access token"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFolderSelect = async () => {
    if (!folderUrl.trim()) {
      toast("Please enter a Google Drive folder URL");
      return;
    }

    try {
      // Extract folder ID from URL
      const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (!folderIdMatch) {
        toast("Invalid folder URL format");
        return;
      }

      const folderId = folderIdMatch[1];
      const token = localStorage.getItem('gdrive_token');

      if (!token) {
        toast("Please connect to Google Drive first");
        return;
      }

      // Get folder info
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Cannot access folder');
      }

      const folderData = await response.json();
      onFolderSelected(folderId, folderData.name);
      
      toast("Folder selected successfully!", {
        description: `Selected: ${folderData.name}`
      });
    } catch (error) {
      toast("Failed to select folder", {
        description: "Please check the folder URL and permissions"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="w-5 h-5" />
          Google Drive Integration
        </CardTitle>
        <CardDescription>
          Connect to Google Drive to upload exported videos directly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isTokenValid ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="access-token">Google Drive Access Token</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="Enter your access token..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your token from{" "}
                <a 
                  href="https://developers.google.com/oauthplayground/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OAuth 2.0 Playground
                </a>
              </p>
            </div>
            
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 mr-2" />
                  Connect to Google Drive
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-green-600">
              <Check className="w-4 h-4" />
              <span className="text-sm">Connected to Google Drive</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="folder-url">Drive Folder URL</Label>
              <Input
                id="folder-url"
                placeholder="https://drive.google.com/drive/folders/..."
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleFolderSelect}
              variant="outline"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Upload Folder
            </Button>
          </>
        )}
        
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-600 dark:text-blue-400">
              <p className="font-medium mb-1">Hướng dẫn:</p>
              <div className="space-y-2">
                <div>
                  <p className="font-medium">1. Lấy Access Token:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Truy cập OAuth 2.0 Playground</li>
                    <li>Chọn "Drive API v3" và authorize scopes</li>
                    <li>Exchange authorization code for tokens</li>
                    <li>Copy access token</li>
                  </ol>
                </div>
                <div>
                  <p className="font-medium">2. Chọn thư mục Drive:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Mở Google Drive trên trình duyệt</li>
                    <li>Vào thư mục bạn muốn lưu file</li>
                    <li>Copy URL từ thanh địa chỉ</li>
                    <li>Paste URL vào ô "Drive Folder URL"</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};