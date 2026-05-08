import torch
import torch.nn as nn
import torchvision.models as models

class ModalityFeatureExtractor(nn.Module):
    """MobileNetV3 Extractor"""
    def __init__(self):
        super(ModalityFeatureExtractor, self).__init__()
        self.conv_blocks = models.mobilenet_v3_small(pretrained=True).features
        
    def forward(self, x):
        return self.conv_blocks(x)

class ResNet18FeatureExtractor(nn.Module):
    """ResNet18 Extractor"""
    def __init__(self):
        super(ResNet18FeatureExtractor, self).__init__()
        resnet = models.resnet18(pretrained=True)
        self.conv_blocks = nn.Sequential(*list(resnet.children())[:-1])

    def forward(self, x):
        return self.conv_blocks(x)

class DynamicFaceLSTM(nn.Module):
    """Face Model that accepts any feature extractor dynamically."""
    def __init__(self, extractor, feature_dim=576, hidden_dim=256, num_layers=2):
        super(DynamicFaceLSTM, self).__init__()
        self.extractor = extractor
        self.pool = nn.AdaptiveAvgPool2d(1)
        
        self.lstm = nn.LSTM(
            input_size=feature_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.3 if num_layers > 1 else 0.0
        )

        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 1),
        )

    def forward(self, x):
        batch_size, seq_len, C, H, W = x.size()
        x = x.view(batch_size * seq_len, C, H, W)

        x = self.extractor(x)
        x = self.pool(x)
        x = x.view(batch_size, seq_len, -1) 

        lstm_out, _ = self.lstm(x)
        last_step_out = lstm_out[:, -1, :] 

        return self.classifier(last_step_out)

class DynamicArmsLSTM(nn.Module):
    """Arms Model that accepts any feature extractor dynamically."""
    def __init__(self, extractor, feature_dim=576, hidden_dim=256, num_layers=2):
        super(DynamicArmsLSTM, self).__init__()
        self.extractor = extractor
        self.pool = nn.AdaptiveAvgPool2d(1)
        
        self.lstm = nn.LSTM(
            input_size=feature_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.3 if num_layers > 1 else 0.0
        )

        self.mlp = nn.Sequential(
            nn.Linear(hidden_dim * 2, 128), 
            nn.BatchNorm1d(128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
        )
        
    def forward(self, l_arm, r_arm):
        B, S, C, H, W = l_arm.size()
        
        l_flat, r_flat = l_arm.view(B * S, C, H, W), r_arm.view(B * S, C, H, W)
        
        l_feats = self.pool(self.extractor(l_flat)).view(B, S, -1)
        r_feats = self.pool(self.extractor(r_flat)).view(B, S, -1)

        l_lstm_out, _ = self.lstm(l_feats)
        r_lstm_out, _ = self.lstm(r_feats)
        
        fused_arms = torch.cat([l_lstm_out[:, -1, :], r_lstm_out[:, -1, :]], dim=-1)
        return self.mlp(fused_arms)

class MultimodalPipeline(nn.Module):
    def __init__(self, face_net=None, arms_net=None):
        super(MultimodalPipeline, self).__init__()
        # Default to MobileNet if none provided
        self.face_net = face_net or DynamicFaceLSTM(ModalityFeatureExtractor(), feature_dim=576)
        self.arms_net = arms_net or DynamicArmsLSTM(ModalityFeatureExtractor(), feature_dim=576)

    def forward(self, face, l_arm, r_arm):
        return self.face_net(face), self.arms_net(l_arm, r_arm)